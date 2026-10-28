/**
 * Writes every transactional email, in every language, to var/mail-preview so
 * they can be checked in a browser before players get them. Nothing is sent.
 *
 *   npm run mail:preview -w @tgh/api
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LOCALES } from '../core/http/request-context';
import { codeEmail, noticeEmail, welcomeEmail, type RenderedEmail } from '../core/mail/templates';

const out = path.resolve('var/mail-preview');
const name = 'krat0_s';
const at = new Date();

const samples: Array<[string, (locale: (typeof LOCALES)[number]) => RenderedEmail]> = [
  ['code-signup', (locale) => codeEmail('signup', name, '482913', locale)],
  ['code-email-change', (locale) => codeEmail('email_change', name, '482913', locale)],
  ['code-password-reset', (locale) => codeEmail('password_reset', name, '482913', locale)],
  ['notice-password-reset', (locale) => noticeEmail('password_reset', { name, at }, locale)],
  ['notice-password-changed', (locale) => noticeEmail('password_changed', { name, at }, locale)],
  ['notice-email-changed', (locale) => noticeEmail('email_changed', { name, at, maskedNewEmail: 'kr••••@gmail.com' }, locale)],
  ['welcome', (locale) => welcomeEmail(name, locale)],
];

await mkdir(out, { recursive: true });
const links: string[] = [];
for (const [key, render] of samples) {
  for (const locale of LOCALES) {
    const email = render(locale);
    const file = `${key}.${locale}`;
    await writeFile(path.join(out, `${file}.html`), email.html);
    await writeFile(path.join(out, `${file}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
    links.push(`<li><a href="${file}.html">${file}</a> — ${email.subject.replace(/</g, '&lt;')} (<a href="${file}.txt">text</a>)</li>`);
  }
}
await writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>TG Hub emails</title><ul style="font-family:sans-serif;line-height:1.8">${links.join('')}</ul>`);
console.log(`${links.length} emails written to ${out}/index.html`);
