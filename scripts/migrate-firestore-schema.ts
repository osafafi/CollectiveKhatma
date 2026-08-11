/**
 * Audit and safely backfill legacy Firestore documents without deleting fields.
 *
 * Default (safe): `npm run migrate:schema` only reads and reports counts.
 * Apply: `npm run migrate:schema -- --apply --confirm=BACKFILL_SCHEMA`
 *
 * The apply mode refuses to run when it finds a partial/non-full khatma because
 * expanding a historical reading scope cannot be inferred without data loss.
 */
import { readFileSync } from 'node:fs';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { DEFAULT_PAGES_PER_DAY } from '../src/domain/types';

type Patch = { ref: DocumentReference; data: Record<string, unknown> };

function loadEnvFile(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of readFileSync('.env', 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    values[key] = rawValue.replace(/^(['"])(.*)\1$/u, '$2');
  }
  return values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

async function commitPatches(patches: readonly Patch[]): Promise<void> {
  const db = patches[0]?.ref.firestore;
  if (!db) return;
  for (let start = 0; start < patches.length; start += 400) {
    const batch = writeBatch(db);
    for (const patch of patches.slice(start, start + 400)) {
      batch.update(patch.ref, patch.data);
    }
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const confirmed = process.argv.includes('--confirm=BACKFILL_SCHEMA');
  if (apply && !confirmed) {
    throw new Error('Apply mode requires --confirm=BACKFILL_SCHEMA');
  }

  const env = loadEnvFile();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || projectId.startsWith('demo-')) {
    throw new Error('A non-demo VITE_FIREBASE_PROJECT_ID is required in .env');
  }
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);

  try {
    const rosterSnap = await getDocs(collection(db, 'roster'));
    const rosterDefaults = new Map<string, number>();
    const rosterPatches: Patch[] = [];
    let unsafeRoster = 0;
    for (const person of rosterSnap.docs) {
      const data = person.data();
      rosterDefaults.set(person.id, numberOr(data.pagesPerDay, DEFAULT_PAGES_PER_DAY));
      const patch: Record<string, unknown> = {};
      if (data.completedPages === undefined) patch.completedPages = [];
      else if (!Array.isArray(data.completedPages)) unsafeRoster += 1;
      if (data.holdPages === undefined) patch.holdPages = false;
      if (Object.keys(patch).length > 0)
        rosterPatches.push({ ref: person.ref, data: patch });
    }

    const khatmaSnap = await getDocs(collection(db, 'khatmas'));
    const khatmaPatches: Patch[] = [];
    const assignmentPatches: Patch[] = [];
    let unsafeKhatmas = 0;
    for (const khatma of khatmaSnap.docs) {
      const data = khatma.data();
      if (data.scope?.kind !== 'full' || data.totalPages !== 604) unsafeKhatmas += 1;

      const memberIds = Array.isArray(data.memberIds)
        ? data.memberIds.filter((value): value is string => typeof value === 'string')
        : [];
      const storedCapacities = isRecord(data.capacities) ? data.capacities : {};
      const capacities: Record<string, { pages: number; surahs: number; juz: number }> =
        {};
      let capacitiesChanged = !isRecord(data.capacities);
      for (const memberId of memberIds) {
        const stored = isRecord(storedCapacities[memberId])
          ? storedCapacities[memberId]
          : {};
        const normalized = {
          pages: numberOr(
            stored.pages,
            rosterDefaults.get(memberId) ?? DEFAULT_PAGES_PER_DAY,
          ),
          surahs: numberOr(stored.surahs, 0),
          juz: numberOr(stored.juz, 0),
        };
        capacities[memberId] = normalized;
        if (
          stored.pages !== normalized.pages ||
          stored.surahs !== normalized.surahs ||
          stored.juz !== normalized.juz
        ) {
          capacitiesChanged = true;
        }
      }
      if (capacitiesChanged) {
        khatmaPatches.push({ ref: khatma.ref, data: { capacities } });
      }

      const assignments = await getDocs(
        collection(db, 'khatmas', khatma.id, 'assignments'),
      );
      for (const assignment of assignments.docs) {
        const assignmentData = assignment.data();
        const patch: Record<string, unknown> = {};
        if (!Array.isArray(assignmentData.rounds)) patch.rounds = [];
        if (!isRecord(assignmentData.doneByRound)) patch.doneByRound = {};
        if (typeof assignmentData.missedStreak !== 'number') patch.missedStreak = 0;
        if (assignmentData.memberId === undefined) patch.memberId = assignment.id;
        if (Object.keys(patch).length > 0) {
          assignmentPatches.push({ ref: assignment.ref, data: patch });
        }
      }
    }

    const totalPatches =
      rosterPatches.length + khatmaPatches.length + assignmentPatches.length;
    console.log(`Firestore schema audit: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`Project: ${projectId}`);
    console.log(
      `Roster: ${rosterSnap.size} scanned, ${rosterPatches.length} need safe defaults, ${unsafeRoster} unsafe`,
    );
    console.log(
      `Khatmas: ${khatmaSnap.size} scanned, ${khatmaPatches.length} need capacity defaults, ${unsafeKhatmas} partial/unsafe`,
    );
    console.log(`Assignments: ${assignmentPatches.length} need required defaults`);
    console.log(`Total documents to update: ${totalPatches}`);

    if (!apply) {
      console.log('No writes performed.');
      return;
    }
    if (unsafeRoster > 0 || unsafeKhatmas > 0) {
      throw new Error('Unsafe legacy shapes found; apply aborted without writing.');
    }
    await commitPatches([...rosterPatches, ...khatmaPatches, ...assignmentPatches]);
    console.log(`Updated ${totalPatches} documents without deleting fields.`);
  } finally {
    await deleteApp(app);
  }
}

await main();
