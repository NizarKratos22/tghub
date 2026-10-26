'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** The sticky header, which lifts off the page (a soft shadow) once the page scrolls under it. */
export function HeaderShell({ className, liftedClassName, children }: { className?: string; liftedClassName?: string; children: ReactNode }) {
  const [lifted, setLifted] = useState(false);
  useEffect(() => {
    const update = () => setLifted(window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return <header className={cx(className, lifted && liftedClassName)}>{children}</header>;
}
