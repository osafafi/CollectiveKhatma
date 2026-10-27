/**
 * The hardcoded per-ayah recitation catalog. Audio streams on demand from
 * EveryAyah (https://everyayah.com), whose files are named by surah and ayah
 * (`002255.mp3`); the QuranicAudio mirror serves the same files under the same
 * folder names and is the automatic fallback. Nothing here is bundled audio:
 * these are only the URLs a player asks for.
 *
 * Ids are short and stable so a stored choice survives a host renaming its
 * folders; display names live in `strings.recitation.qariNames`.
 */

export interface Qari {
  readonly id: string;
  /** Folder name, identical on the primary host and the mirror. */
  readonly folder: string;
  /** Whether the QuranicAudio mirror also carries this folder. */
  readonly mirror: boolean;
}

export const QARIS = [
  { id: 'alafasy', folder: 'Alafasy_128kbps', mirror: true },
  { id: 'abdulbasit', folder: 'Abdul_Basit_Murattal_192kbps', mirror: true },
  { id: 'husary', folder: 'Husary_128kbps', mirror: true },
  { id: 'minshawi', folder: 'Minshawy_Murattal_128kbps', mirror: true },
  { id: 'maher', folder: 'MaherAlMuaiqly128kbps', mirror: false },
  { id: 'sudais', folder: 'Abdurrahmaan_As-Sudais_192kbps', mirror: true },
  { id: 'shuraim', folder: 'Saood_ash-Shuraym_128kbps', mirror: true },
  { id: 'shatri', folder: 'Abu_Bakr_Ash-Shaatree_128kbps', mirror: true },
  { id: 'rifai', folder: 'Hani_Rifai_192kbps', mirror: true },
  { id: 'ayyub', folder: 'Muhammad_Ayyoub_128kbps', mirror: true },
  { id: 'dossari', folder: 'Yasser_Ad-Dussary_128kbps', mirror: true },
  { id: 'qatami', folder: 'Nasser_Alqatami_128kbps', mirror: false },
  { id: 'ajmi', folder: 'ahmed_ibn_ali_al_ajamy_128kbps', mirror: false },
  { id: 'hudhaify', folder: 'Hudhaify_128kbps', mirror: true },
  { id: 'jibreel', folder: 'Muhammad_Jibreel_128kbps', mirror: true },
  { id: 'basfar', folder: 'Abdullah_Basfar_192kbps', mirror: true },
  // EveryAyah carries Saad Al-Ghamdi at 40kbps only.
  { id: 'ghamdi', folder: 'Ghamadi_40kbps', mirror: true },
] as const satisfies readonly Qari[];

export type QariId = (typeof QARIS)[number]['id'];

export const DEFAULT_QARI_ID: QariId = 'alafasy';

/** Every surah's ayah-1 file starts after the basmala; 1:1 is the basmala itself. */
export const BASMALA_REF = { surah: 1, ayah: 1 } as const;

/**
 * The tail overlap between ayat, in ms. Files are cut differently per voice,
 * so members can tune it per qari in Settings; 0 turns the overlap off.
 */
export const VERSE_OVERLAP_MS = { default: 200, min: 0, max: 600, step: 25 } as const;

export function clampVerseOverlapMs(value: number): number {
  const stepped = Math.round(value / VERSE_OVERLAP_MS.step) * VERSE_OVERLAP_MS.step;
  return Math.min(VERSE_OVERLAP_MS.max, Math.max(VERSE_OVERLAP_MS.min, stepped));
}

/** Ayat al-Kursi, the Settings preview. */
export const PREVIEW_REF = { surah: 2, ayah: 255, page: 42 } as const;

const PRIMARY_HOST = 'https://everyayah.com/data/';
const MIRROR_HOST = 'https://mirrors.quranicaudio.com/everyayah/';

const QARI_IDS: ReadonlySet<string> = new Set(QARIS.map((qari) => qari.id));

export function isQariId(value: unknown): value is QariId {
  return typeof value === 'string' && QARI_IDS.has(value);
}

export function qariById(id: QariId): Qari {
  return QARIS.find((qari) => qari.id === id) ?? QARIS[0];
}

/** The ayah's file on the primary host, then on the mirror when it has the folder. */
export function ayahAudioUrls(qariId: QariId, surah: number, ayah: number): string[] {
  const qari = qariById(qariId);
  const file = `${pad3(surah)}${pad3(ayah)}.mp3`;
  const urls = [`${PRIMARY_HOST}${qari.folder}/${file}`];
  if (qari.mirror) urls.push(`${MIRROR_HOST}${qari.folder}/${file}`);
  return urls;
}

function pad3(value: number): string {
  return String(value).padStart(3, '0');
}
