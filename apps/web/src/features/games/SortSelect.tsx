'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/I18nProvider';
import styles from './SortSelect.module.css';

interface SortOption {
  value: string;
  label: string;
  href: string;
}

/** The one filter control that needs JS: a select that navigates on change. */
export function SortSelect({ value, options, label }: { value: string; options: SortOption[]; label?: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <label className={styles.sort}>
      <span className="label">{label ?? t.market.sort}</span>
      <select
        value={value}
        onChange={(event) => {
          const option = options.find((o) => o.value === event.target.value);
          if (option) router.push(option.href, { scroll: false });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
