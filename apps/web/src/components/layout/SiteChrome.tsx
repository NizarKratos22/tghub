import type { ReactNode } from 'react';
import { VerifyEmailBanner } from '@/features/auth/VerifyEmailBanner';
import { LevelUpWatcher } from '@/features/universe/LevelUpWatcher';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Public-site frame: ticker, header, footer. The admin dashboard has its own shell. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <VerifyEmailBanner />
      <main id="main">{children}</main>
      <SiteFooter />
      <LevelUpWatcher />
    </>
  );
}
