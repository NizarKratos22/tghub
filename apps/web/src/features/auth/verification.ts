import type { EmailVerificationStatus } from '@tgh/shared';

const KEY = 'tgh-verify';

/** Carries the sign-up response (masked email, expiry, dev code) to the verify page. */
export function rememberVerification(status: EmailVerificationStatus) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(status));
  } catch {
    // The verify page can fetch the status itself.
  }
}

export function recallVerification(): EmailVerificationStatus | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const status = JSON.parse(raw) as EmailVerificationStatus;
    return new Date(status.expiresAt).getTime() > Date.now() ? status : null;
  } catch {
    return null;
  }
}

export function forgetVerification() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
