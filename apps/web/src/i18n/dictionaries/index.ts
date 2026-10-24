import type { Locale } from '../config';
import { ar } from './ar';
import { en, type Dictionary } from './en';
import { fr } from './fr';

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar };
