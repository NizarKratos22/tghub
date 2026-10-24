import type { ReactNode } from 'react';
import { getT } from '@/i18n/server';
import styles from './auth.module.css';

const PERK_CODES = ['XP', 'PC', 'TND', 'TN'];

export async function AuthLayout({ kicker, title, children }: { kicker: string; title: ReactNode; children: ReactNode }) {
  const t = await getT();
  const perks = PERK_CODES.map((code, index) => ({ code, text: t.auth.perks[index]! }));
  return (
    <div className={`container ${styles.wrap}`}>
      <section className={styles.pitch}>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
        <ul className={styles.perks}>
          {perks.map((perk) => (
            <li key={perk.code}>
              <span>{perk.code}</span>
              {perk.text}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.panel}>{children}</section>
    </div>
  );
}
