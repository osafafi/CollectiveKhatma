import { AppSelectField, type SelectOption } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';
import type { Surah } from '@/content/quran/types';

export interface SurahCapacitySelectProps {
  /** All surahs (names) for the options, or `null` while they load. */
  surahs: readonly Surah[] | null;
  /** Selected surah id; `0` = none. */
  value: number;
  onChange: (surahId: number) => void;
}

/**
 * The per-member surah capacity as a name dropdown (first option = none `—`)
 * instead of a raw number — shared by the Khatmas create form (RM-520) and the
 * Khatma detail capacity editor / add-member row (RM-530). The React twin of the
 * legacy `surahCapacitySelect` / `surahSelectEl`.
 */
export function SurahCapacitySelect({ surahs, value, onChange }: SurahCapacitySelectProps) {
  const options: SelectOption[] = [
    { value: '', label: strings.admin.noSurah },
    ...(surahs ?? []).map((surah) => ({
      value: String(surah.id),
      label: `${toArabicDigits(surah.id)}. ${surah.name}`,
    })),
  ];
  return (
    <AppSelectField
      label={strings.admin.capacitySurahs}
      value={value > 0 ? String(value) : ''}
      options={options}
      fieldWidth={200}
      onChange={(next) => onChange(next ? parseInt(next, 10) : 0)}
    />
  );
}
