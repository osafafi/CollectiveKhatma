import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
import {
  DailyDuasConflictError,
  getGlobalContent,
  setDailyDu3as,
  setDu3aText,
} from '@/data/content';

const enabled = process.env.RUN_FIRESTORE_EMULATOR_SMOKE === 'true';

it.skipIf(!enabled)(
  'persists daily content, rejects stale writes and invalid rule shapes in the emulator',
  async () => {
    if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
      throw new Error('Local emulator required');
    const app = initializeApp({ projectId: 'collectivekhatma' }, 'daily-dua-smoke');
    const ref = getFirestore(app).doc('content/global');
    const original = await ref.get();
    const endpoint =
      'http://127.0.0.1:8080/v1/projects/collectivekhatma/databases/(default)/documents/content/global';
    try {
      await ref.set({ du3aText: 'khatma smoke' });
      await setDailyDu3as(['first', 'second'], null);
      expect(await getGlobalContent()).toEqual({
        du3aText: 'khatma smoke',
        dailyDu3as: ['first', 'second'],
      });
      await expect(setDailyDu3as(['stale'], null)).rejects.toBeInstanceOf(
        DailyDuasConflictError,
      );
      await setDu3aText('edited khatma');
      expect((await getGlobalContent())?.dailyDu3as).toEqual(['first', 'second']);
      await setDailyDu3as([], ['first', 'second']);
      expect((await getGlobalContent())?.dailyDu3as).toEqual([]);
      for (const dailyDu3as of [
        { stringValue: 'invalid' },
        { arrayValue: { values: Array(101).fill({ stringValue: 'a' }) } },
      ]) {
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { dailyDu3as } }),
        });
        expect(response.status).toBe(403);
      }
    } finally {
      if (original.exists) await ref.set(original.data()!);
      else await ref.delete();
      await deleteApp(app);
    }
  },
  30000,
);
