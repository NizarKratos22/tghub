'use client';

import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nProvider';
import { applyTheme, currentTheme, storedTheme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';

/**
 * Both icons render on the server and CSS shows the right one for the theme
 * already on <html>, so there's nothing to reconcile on hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  useEffect(() => {
    // Follow the OS until the player picks a side.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (event: MediaQueryListEvent) => {
      if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light', false);
    };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  return (
    <button
      type="button"
      className={`${styles.toggle} ${className ?? ''}`}
      aria-label={t.common.themeToggle}
      title={t.common.themeToggle}
      onClick={() => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true)}
    >
      <Icon name="moon" size={18} className={styles.moon} />
      <Icon name="sun" size={18} className={styles.sun} />
    </button>
  );
}
