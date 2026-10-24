import type { Metadata, Viewport } from 'next';
import { Cairo, Montserrat, Roboto, Teko } from 'next/font/google';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { directionOf } from '@/i18n/config';
import { I18nProvider } from '@/i18n/I18nProvider';
import { getLocale } from '@/i18n/server';
import { themeBootScript } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

const display = Montserrat({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-montserrat' });
const body = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });
// Arabic script: Montserrat and Roboto have no Arabic glyphs.
const arabic = Cairo({ subsets: ['arabic', 'latin'], weight: ['500', '600', '700', '800'], variable: '--font-cairo' });
const numerals = Teko({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-teko' });

export const metadata: Metadata = {
  title: { default: 'TG Hub — Tunisian Gaming Hub', template: '%s · TG Hub' },
  description:
    'Game news, patch notes, deals and events in one Radar. A gaming marketplace for gear and FiveM assets, PC checks, missions and XP — built in Tunisia.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2123' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    // The boot script sets data-theme before hydration, so React must not fight it.
    <html lang={locale} dir={directionOf(locale)} className={`${display.variable} ${body.variable} ${numerals.variable} ${arabic.variable}`} suppressHydrationWarning>
      <body>
        {/* beforeInteractive: Next puts it in <head> and runs it before hydration, so the theme never flashes. */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        {/* Public pages get the site header and footer from (site)/layout; /admin has its own shell. */}
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
