import { AppSelectField, type SelectOption } from '@/components/primitives';
import { strings } from '@/content/strings.ar';
import { toArabicDigits } from '@/content/quran/symbols';

export interface JuzCapacitySelectProps {
  /** Selected Juz number; `0` = none. */
  value: number;
  onChange: (juzNumber: number) => void;
}

/** A specific Juz-number dropdown shared by all admin capacity forms. */
export function JuzCapacitySelect({ value, onChange }: JuzCapacitySelectProps) {
  const options: SelectOption[] = [
    { value: '', label: strings.admin.noJuz },
    ...Array.from({ length: 30 }, (_, index) => {
      const juzNumber = index + 1;
      return { value: String(juzNumber), label: toArabicDigits(juzNumber) };
    }),
  ];
  return (
    <AppSelectField
      label={strings.admin.capacityJuz}
      value={value >= 1 && value <= 30 ? String(value) : ''}
      options={options}
      fieldWidth={120}
      onChange={(next) => onChange(next ? parseInt(next, 10) : 0)}
    />
  );
}
