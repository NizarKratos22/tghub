import type { AuthContext } from '../core/auth/context';

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext | null;
      authVia: 'cookie' | 'bearer' | null;
      /** Unparsed JSON body, kept only where a signature covers it (Discord interactions). */
      rawBody?: Buffer;
    }
  }
}

export {};
