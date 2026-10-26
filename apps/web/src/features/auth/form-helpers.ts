/**
 * Sign-up helpers that run in the browser as people type. The server still
 * decides: these only explain its rules early (8+ characters) and nudge
 * towards stronger choices.
 */

const COMMON = /^(?:password|motdepasse|azerty|qwerty|123456|12345678|123456789|111111|000000|abc123|iloveyou|tghub|tunisia|tunisie)/i;

export interface PasswordCheck {
  /** 0 too short · 1 weak · 2 okay · 3 strong · 4 excellent */
  score: 0 | 1 | 2 | 3 | 4;
  rules: { length: boolean; mixedCase: boolean; numberOrSymbol: boolean };
}

/** Strength from length and variety; reusing the username or email, or a well-known password, caps it at weak. */
export function checkPassword(password: string, related: string[] = []): PasswordCheck {
  const rules = {
    length: password.length >= 8,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    numberOrSymbol: /[\d\W_]/.test(password),
  };
  if (!rules.length) return { score: 0, rules };
  const lower = password.toLowerCase();
  const reused = related.some((word) => word.length >= 3 && lower.includes(word.toLowerCase()));
  if (reused || COMMON.test(password) || /^(.)\1+$/.test(password)) return { score: 1, rules };
  const score = 1 + Number(password.length >= 12) + Number(rules.mixedCase) + Number(rules.numberOrSymbol);
  return { score: Math.min(4, score) as PasswordCheck['score'], rules };
}

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.fr': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmal.fr': 'hotmail.fr',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahooo.fr': 'yahoo.fr',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'icloud.co': 'icloud.com',
};

/** "ahmed@gmial.com" → "ahmed@gmail.com"; null when the address looks fine. */
export function emailSuggestion(email: string): string | null {
  const at = email.trim().lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  const fixed = DOMAIN_TYPOS[domain];
  return fixed ? `${email.trim().slice(0, at)}@${fixed}` : null;
}

export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
