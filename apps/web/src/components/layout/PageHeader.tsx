import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  code: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}

/** Top of every section page: running code, big condensed title, one line of purpose. */
export function PageHeader({ code, title, lede, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.text}>
          <p className={styles.code}>{code}</p>
          <h1 className={styles.title}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </div>
        {children ? <div className={styles.aside}>{children}</div> : null}
      </div>
    </header>
  );
}
