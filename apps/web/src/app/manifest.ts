import type { MetadataRoute } from 'next';

/** Lets phones install TG Hub to the home screen — which iOS requires before it allows notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TG Hub — Tunisian Gaming Hub',
    short_name: 'TG Hub',
    description: 'Game news, a gaming marketplace, PC checks, missions and XP — built in Tunisia.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1f2123',
    // The logo's blue (public/brand).
    theme_color: '#0089fb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
