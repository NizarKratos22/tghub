/**
 * React Query keys shared by client components and the server pages that
 * pre-fill them (a server component can't import values from a 'use client'
 * module, so they live here).
 */
export const SESSION_KEY = ['session'] as const;

export const UNIVERSE_KEYS = {
  progression: ['universe', 'me'] as const,
  history: ['universe', 'xp-history'] as const,
  missions: ['universe', 'missions'] as const,
  achievements: ['universe', 'achievements'] as const,
};
