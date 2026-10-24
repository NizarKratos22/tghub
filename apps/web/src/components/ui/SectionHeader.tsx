import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  title: string;
  kicker?: string;
  action?: { href: string; label: string };
  children?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}

export function SectionHeader({ title, kicker, action, children, as: Heading = 'h2' }: SectionHeaderProps) {
  return (
    <header className={styles.head}>
      <div className={styles.titleRow}>
        <Heading className={styles.title}>{title}</Heading>
        {children}
        {action ? (
          <Link href={action.href} className={styles.action}>
            {action.label}
            <Icon name="chevronRight" size={16} />
          </Link>
        ) : null}
      </div>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
    </header>
  );
}
