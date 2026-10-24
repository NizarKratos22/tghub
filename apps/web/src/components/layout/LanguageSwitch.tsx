'use client';

import { LOCALES, LOCALE_NAMES } from '@/i18n/config';
import { switchLocale, useLocale, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './LanguageSwitch.module.css';

/** EN · FR · العربية — each label in its own language, so anyone can find theirs. */
export function LanguageSwitch({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const locale = useLocale();
  const t = useT();
  return (
    <div className={cx(styles.switch, tone === 'dark' && styles.dark, className)} role="radiogroup" aria-label={t.common.language}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={locale === code}
          lang={code}
          className={cx(styles.option, locale === code && styles.on)}
          onClick={() => locale !== code && switchLocale(code)}
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}
