/**
 * Transactional emails. Table layout and inline styles because mail clients
 * ignore most stylesheets; every message also carries a plain-text part.
 * Words live in copy.ts (English, French, Arabic); this file only lays them out.
 *
 * Outlook for Windows renders with Word: it ignores max-width, padding on links
 * and sizes on <div>, hence the ghost table, mso-padding-alt and table-cell shapes.
 */
import { env } from '../../config/env';
import type { Locale } from '../http/request-context';
import { MAIL_COPY, type CodePurpose, type MailCopy, type NoticeKind } from './copy';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/* Brand, matched to the site's light theme. */
const COLOR = {
  page: '#eef1f5',
  card: '#ffffff',
  border: '#e3e7ec',
  header: '#1b232b', // the dark logo's own background, so the PNG blends in
  accent: '#0a96e8',
  accentText: '#0b74b8',
  codeBg: '#f1f8fe',
  codeBorder: '#cfe6f7',
  noteBg: '#f7f8fa',
  text: '#1f2123',
  text2: '#44484d',
  text3: '#62686d',
  muted: '#868b91',
  defendr: '#e8175d',
};
const FONT_LATIN = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_ARABIC = "Tahoma, 'Segoe UI', Arial, sans-serif";
const FONT_CODE = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
const DEFENDR_URL = 'https://defendr.gg/';
const WIDTH = 560;
/** Square corners in Outlook, rounded elsewhere: tables with a radius must not collapse their borders. */
const ROUNDED_TABLE = 'border-collapse:separate;border-spacing:0;';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const webUrl = (path = '') => `${env.PUBLIC_WEB_URL.replace(/\/+$/, '')}${path}`;

/** "123 456": easier to read and to type from a phone. */
const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** "28 October 2026 at 21:30 (Tunis time)", in the email's language. */
function tunisTime(at: Date, copy: MailCopy): string {
  // 24-hour clock in every language, as on the site (fr-TN and ar-TN default to 12-hour).
  const formatted = new Intl.DateTimeFormat(copy.dateLocale, { dateStyle: 'long', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Africa/Tunis' }).format(at);
  return `${formatted} (${copy.tunisTime})`;
}

const fontFor = (copy: MailCopy) => (copy.dir === 'rtl' ? FONT_ARABIC : FONT_LATIN);
const startSide = (copy: MailCopy) => (copy.dir === 'rtl' ? 'right' : 'left');

interface Layout {
  locale: Locale;
  title: string;
  eyebrow: string;
  preheader: string;
  /** Already-escaped HTML for the card body, below the title. */
  body: string;
}

function layout({ locale, title, eyebrow, preheader, body }: Layout): string {
  const copy = MAIL_COPY[locale];
  const rtl = copy.dir === 'rtl';
  const start = startSide(copy);
  const font = fontFor(copy);
  const logo = webUrl('/brand/tg-hub-email-logo.png');
  // Gmail drops attributes on <html>/<body>, so direction is repeated on the tables that hold the text.
  return `<!doctype html>
<html lang="${locale}" dir="${copy.dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; }
  img { border: 0; outline: none; text-decoration: none; }
  @media (max-width: 600px) {
    .card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .pad { padding-left: 22px !important; padding-right: 22px !important; }
    .code { font-size: 30px !important; letter-spacing: 6px !important; }
    .title { font-size: 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${'&#8204;&nbsp;'.repeat(120)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.page}" style="background:${COLOR.page};" dir="${copy.dir}">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="${WIDTH}" align="center" cellpadding="0" cellspacing="0" border="0" dir="${copy.dir}"><tr><td width="${WIDTH}"><![endif]-->
  <table role="presentation" class="card" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" dir="${copy.dir}" bgcolor="${COLOR.card}" style="width:100%;max-width:${WIDTH}px;background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:14px;overflow:hidden;${ROUNDED_TABLE}">
    <tr><td align="${start}" bgcolor="${COLOR.header}" style="background-color:${COLOR.header};background-image:linear-gradient(${COLOR.header},${COLOR.header});padding:20px 32px;">
      <a href="${escapeHtml(webUrl())}" style="color:#ffffff;text-decoration:none;"><img src="${escapeHtml(logo)}" width="150" height="49" alt="TG Hub" style="display:block;width:150px;height:auto;border:0;color:#ffffff;font-family:${FONT_LATIN};font-size:22px;font-weight:800;line-height:49px;"></a>
    </td></tr>
    <tr><td height="4" bgcolor="${COLOR.accent}" style="height:4px;font-size:4px;line-height:4px;mso-line-height-rule:exactly;background:${COLOR.accent};">&nbsp;</td></tr>
    <tr><td class="pad" style="padding:34px 32px 30px;font-family:${font};text-align:${start};color:${COLOR.text};">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:${rtl ? '0' : '1.2px'};text-transform:uppercase;color:${COLOR.accentText};">${escapeHtml(eyebrow)}</p>
      <h1 class="title" style="margin:0 0 22px;font-size:25px;line-height:1.3;font-weight:800;color:${COLOR.text};">${escapeHtml(title)}</h1>
      ${body}
      <p style="margin:26px 0 0;font-size:15px;line-height:1.6;color:${COLOR.text2};">${escapeHtml(copy.signature)}</p>
    </td></tr>
  </table>
  <table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0" dir="${copy.dir}" style="width:100%;max-width:${WIDTH}px;">
    <tr><td class="pad" style="padding:22px 32px 8px;font-family:${font};font-size:12px;line-height:1.6;color:${COLOR.muted};text-align:center;">
      <p style="margin:0 0 6px;font-weight:700;color:${COLOR.text3};">${escapeHtml(copy.footer.tagline)}</p>
      <p style="margin:0 0 6px;">${escapeHtml(copy.footer.reason)} ${escapeHtml(copy.footer.help)}</p>
      <p style="margin:0;">${escapeHtml(copy.footer.poweredBy)} <a href="${DEFENDR_URL}" style="color:${COLOR.defendr};font-weight:700;text-decoration:none;">Defendr.gg</a></p>
    </td></tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

const paragraph = (text: string, font: string, color = COLOR.text2) =>
  `<p style="margin:0 0 16px;font-family:${font};font-size:15px;line-height:1.65;color:${color};">${escapeHtml(text)}</p>`;

/** A box with a side rule on the reading-start side. */
function note(text: string, copy: MailCopy): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;${ROUNDED_TABLE}"><tr>
<td bgcolor="${COLOR.noteBg}" style="background:${COLOR.noteBg};border-${startSide(copy)}:3px solid ${COLOR.accent};border-radius:8px;padding:14px 16px;font-family:${fontFor(copy)};font-size:13.5px;line-height:1.6;color:${COLOR.text3};">${escapeHtml(text)}</td>
</tr></table>`;
}

/** Bulletproof button: padding on the link for most clients, mso-padding-alt on the cell for Outlook. */
function button(label: string, href: string, font: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 8px;${ROUNDED_TABLE}"><tr>
<td align="center" bgcolor="${COLOR.accent}" style="border-radius:10px;background:${COLOR.accent};mso-padding-alt:13px 26px;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

const link = (label: string, href: string, font: string) =>
  `<p style="margin:12px 0 0;font-family:${font};font-size:14px;"><a href="${escapeHtml(href)}" style="color:${COLOR.accentText};font-weight:600;text-decoration:underline;">${escapeHtml(label)}</a></p>`;

/** Joins plain-text blocks with blank lines and adds the footer. */
function plainText(copy: MailCopy, blocks: string[]): string {
  return [
    ...blocks,
    copy.signature,
    '—',
    `${copy.footer.tagline} · ${webUrl()}`,
    `${copy.footer.reason} ${copy.footer.help}`,
    `${copy.footer.poweredBy} Defendr.gg · ${DEFENDR_URL}`,
  ].join('\n\n');
}

/* ───────────── One-time codes ───────────── */

/** `name` is empty when the address isn't proven yet, so nothing a player typed reaches a stranger. */
export function codeEmail(purpose: CodePurpose, name: string, code: string, locale: Locale): RenderedEmail {
  const copy = MAIL_COPY[locale];
  const words = copy.codes[purpose];
  const font = fontFor(copy);
  const spaced = spacedCode(code);
  // Inside Arabic text the two digit groups would swap places; marks keep "482 913" in order.
  const spacedText = copy.dir === 'rtl' ? `‎${spaced}‎` : spaced;
  const codeBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;${ROUNDED_TABLE}"><tr>
<td align="center" bgcolor="${COLOR.codeBg}" style="background:${COLOR.codeBg};border:1px solid ${COLOR.codeBorder};border-radius:12px;padding:20px 16px 18px;font-family:${font};">
  <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:${copy.dir === 'rtl' ? '0' : '1px'};text-transform:uppercase;color:${COLOR.text3};">${escapeHtml(copy.codeLabel)}</p>
  <p class="code" dir="ltr" style="margin:0;font-family:${FONT_CODE};font-size:36px;line-height:1.2;font-weight:700;letter-spacing:8px;color:${COLOR.text};">${escapeHtml(spaced)}</p>
  <p style="margin:8px 0 0;font-size:13px;color:${COLOR.text3};">${escapeHtml(copy.expires)}</p>
</td></tr></table>`;

  return {
    subject: words.subject(code),
    text: plainText(copy, [copy.greeting(name), words.intro, spacedText, copy.expires, copy.neverShare, words.notYou]),
    html: layout({
      locale,
      title: words.title,
      eyebrow: words.eyebrow,
      // A reset code never shows in previews: phones put them on the lock screen.
      preheader: purpose === 'password_reset' ? copy.expires : copy.codePreheader(code),
      body: [paragraph(copy.greeting(name), font, COLOR.text), paragraph(words.intro, font), codeBox, note(`${copy.neverShare} ${words.notYou}`, copy)].join('\n'),
    }),
  };
}

/* ───────────── Security notices ───────────── */

/** Sent to the address on file (the old one, for an email change), so a takeover gets noticed. */
export function noticeEmail(kind: NoticeKind, details: { name: string; at: Date; maskedNewEmail?: string }, locale: Locale): RenderedEmail {
  const copy = MAIL_COPY[locale];
  const words = copy.notices[kind];
  const font = fontFor(copy);
  const start = startSide(copy);
  const rows: Array<[string, string]> = [[copy.when, tunisTime(details.at, copy)]];
  if (kind === 'email_changed' && details.maskedNewEmail) rows.push([copy.newEmail, details.maskedNewEmail]);
  const cell = (index: number) => `padding:12px 16px;${index > 0 ? `border-top:1px solid ${COLOR.border};` : ''}font-family:${font};text-align:${start};`;
  const facts = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;border:1px solid ${COLOR.border};border-radius:10px;${ROUNDED_TABLE}">
${rows
  .map(
    ([label, value], index) => `<tr>
<td style="${cell(index)}font-size:13px;color:${COLOR.text3};white-space:nowrap;width:1%;">${escapeHtml(label)}</td>
<td style="${cell(index)}font-size:14px;font-weight:600;color:${COLOR.text};word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
</tr>`,
  )
  .join('\n')}
</table>`;
  // The old address can no longer reset the password (the account moved), so it gets "secure your account" instead.
  const moved = kind === 'email_changed';
  const action = moved ? { label: copy.secureCta, href: webUrl('/settings') } : { label: copy.resetCta, href: webUrl('/forgot-password') };

  return {
    subject: words.subject,
    text: plainText(copy, [
      copy.greeting(details.name),
      words.body,
      rows.map(([label, value]) => `${label}${copy.colon}${value}`).join('\n'),
      words.notYou,
      `${action.label}${copy.colon}${action.href}`,
      ...(moved ? [] : [`${copy.devicesLink}${copy.colon}${webUrl('/settings')}`]),
    ]),
    html: layout({
      locale,
      title: words.title,
      eyebrow: words.eyebrow,
      preheader: words.preheader,
      body: [
        paragraph(copy.greeting(details.name), font, COLOR.text),
        paragraph(words.body, font),
        facts,
        paragraph(words.notYou, font),
        button(action.label, action.href, font),
        ...(moved ? [] : [link(copy.devicesLink, webUrl('/settings'), font)]),
      ].join('\n'),
    }),
  };
}

/* ───────────── Welcome ───────────── */

/** Sent once, right after a player confirms their email. */
export function welcomeEmail(name: string, locale: Locale): RenderedEmail {
  const copy = MAIL_COPY[locale];
  const words = copy.welcome;
  const font = fontFor(copy);
  const start = startSide(copy);
  // The bullet is a 10×10 table cell: Outlook ignores sizes on <div>.
  const bullet = `<table role="presentation" width="10" cellpadding="0" cellspacing="0" border="0" style="${ROUNDED_TABLE}"><tr><td width="10" height="10" bgcolor="${COLOR.accent}" style="width:10px;height:10px;border-radius:3px;background:${COLOR.accent};font-size:1px;line-height:1px;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`;
  const features = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 24px;">
${words.features
  .map(
    (feature) => `<tr>
<td valign="top" width="22" style="width:22px;padding:7px 0 12px;">${bullet}</td>
<td valign="top" style="padding:0 0 12px;font-family:${font};font-size:15px;line-height:1.55;color:${COLOR.text2};text-align:${start};"><strong style="color:${COLOR.text};">${escapeHtml(feature.name)}</strong><br>${escapeHtml(feature.text)}</td>
</tr>`,
  )
  .join('\n')}
</table>`;

  return {
    subject: words.subject(name),
    text: plainText(copy, [
      copy.greeting(name),
      words.intro,
      words.features.map((feature) => `• ${feature.name}${copy.colon}${feature.text}`).join('\n'),
      `${words.cta}${copy.colon}${webUrl()}`,
    ]),
    html: layout({
      locale,
      title: words.title,
      eyebrow: words.eyebrow,
      preheader: words.preheader,
      body: [paragraph(copy.greeting(name), font, COLOR.text), paragraph(words.intro, font), features, button(words.cta, webUrl(), font)].join('\n'),
    }),
  };
}
