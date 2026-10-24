/**
 * Transactional emails. Table layout and inline styles because mail clients
 * ignore stylesheets; every message also carries a plain-text part.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function frame(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#1f2123">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="background:#17191c;padding:18px 24px"><span style="display:inline-block;background:#e10600;color:#fff;font-weight:800;font-size:13px;padding:6px 8px;border-radius:6px">TG</span>
<span style="color:#fff;font-weight:800;font-size:17px;letter-spacing:1px;margin-left:8px">HUB</span></td></tr>
<tr><td style="padding:28px 24px 8px">${inner}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#868b91">TG Hub — Tunisian Gaming Hub</td></tr>
</table></td></tr></table></body></html>`;
}

const PURPOSE_COPY = {
  signup: { subject: 'verification code', intro: 'Here is your code to confirm your email on TG Hub:' },
  email_change: { subject: 'code to confirm your new email', intro: 'Here is your code to confirm this as your new TG Hub email:' },
  password_reset: { subject: 'password reset code', intro: 'Someone asked to reset your TG Hub password. If it was you, use this code:' },
} as const;

export function codeEmail(purpose: keyof typeof PURPOSE_COPY, name: string, code: string) {
  const copy = PURPOSE_COPY[purpose];
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${code} is your TG Hub ${copy.subject}`,
    text: `Hi ${name}, ${copy.intro} ${code}. It expires in 15 minutes. If this wasn't you, ignore this email — your account stays as it is.`,
    html: frame(`<p style="margin:0 0 8px;font-size:15px">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;font-size:15px;color:#44484d">${copy.intro}</p>
<p style="margin:0 0 20px;text-align:center"><span style="display:inline-block;padding:14px 22px;border-radius:8px;background:#f3f4f6;font-size:32px;font-weight:800;letter-spacing:6px;font-family:Consolas,Menlo,monospace">${spaced}</span></p>
<p style="margin:0 0 6px;font-size:13px;color:#62686d">It expires in 15 minutes. Never share it — TG Hub staff will never ask for it.</p>
<p style="margin:0 0 24px;font-size:13px;color:#62686d">If this wasn't you, ignore this email — your account stays as it is.</p>`),
  };
}

/** Security notices: sent to the address that used to be on file, so a takeover is noticed. */
export function noticeEmail(name: string, heading: string, body: string) {
  return {
    subject: `TG Hub: ${heading}`,
    text: `Hi ${name}, ${body} If this wasn't you, reset your password right away and contact TG Hub support.`,
    html: frame(`<p style="margin:0 0 8px;font-size:15px">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 12px;font-size:17px;font-weight:700">${escapeHtml(heading)}</p>
<p style="margin:0 0 16px;font-size:15px;color:#44484d">${escapeHtml(body)}</p>
<p style="margin:0 0 24px;font-size:13px;color:#62686d">If this wasn't you, reset your password right away and contact TG Hub support.</p>`),
  };
}
