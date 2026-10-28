import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LOCALES } from '../http/request-context';
import type { CodePurpose, NoticeKind } from './copy';
import { codeEmail, noticeEmail, welcomeEmail, type RenderedEmail } from './templates';

const PURPOSES: CodePurpose[] = ['signup', 'email_change', 'password_reset'];
const NOTICES: NoticeKind[] = ['password_reset', 'password_changed', 'email_changed'];

/** No template variable leaked through as "undefined" or an object. */
function assertClean(email: RenderedEmail) {
  for (const part of [email.subject, email.text, email.html]) {
    assert.ok(part.length > 0);
    assert.doesNotMatch(part, /undefined|\[object |NaN/);
  }
}

/** The hidden inbox-preview text at the top of the body. */
const preheaderOf = (html: string) => /<div style="display:none;[^"]*">([^&<]*)/.exec(html)?.[1] ?? '';

describe('code emails', () => {
  for (const locale of LOCALES) {
    for (const purpose of PURPOSES) {
      test(`${purpose} in ${locale} carries the code in the body`, () => {
        const email = codeEmail(purpose, 'Sami', '482913', locale);
        assertClean(email);
        assert.match(email.text, /482 913/);
        assert.match(email.html, /482 913/);
        assert.match(email.html, new RegExp(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`));
      });
    }

    test(`a reset code never reaches the subject or the preview in ${locale} (lock screens show both)`, () => {
      const email = codeEmail('password_reset', 'Sami', '482913', locale);
      assert.doesNotMatch(email.subject, /482/);
      assert.doesNotMatch(preheaderOf(email.html), /482/);
    });

    test(`sign-up and new-email codes are in the subject in ${locale}`, () => {
      assert.match(codeEmail('signup', '', '482913', locale).subject, /482913/);
      assert.match(codeEmail('email_change', '', '482913', locale).subject, /482913/);
    });
  }

  test('an empty name greets without one (unproven addresses)', () => {
    assert.match(codeEmail('signup', '', '482913', 'en').text, /^Hi,\n/);
    assert.match(codeEmail('signup', '', '482913', 'fr').text, /^Bonjour,\n/);
    assert.match(codeEmail('signup', '', '482913', 'ar').text, /^مرحبًا،\n/);
  });

  test('Arabic lays out right to left, the code stays in order', () => {
    const email = codeEmail('signup', 'Sami', '482913', 'ar');
    assert.match(email.html, /<table[^>]*dir="rtl"/);
    assert.match(email.html, /text-align:right/);
    assert.match(email.html, /class="code" dir="ltr"/);
    // Left-to-right marks keep "482 913" from showing as "913 482" inside Arabic text.
    assert.match(email.text, /‎482 913‎/);
  });
});

describe('security notices', () => {
  for (const locale of LOCALES) {
    for (const kind of NOTICES) {
      test(`${kind} in ${locale}`, () => {
        const email = noticeEmail(kind, { name: 'Sami', at: new Date('2026-10-28T20:30:00Z'), maskedNewEmail: 'sa••••@gmail.com' }, locale);
        assertClean(email);
        // Tunis is UTC+1, on a 24-hour clock in every language.
        assert.match(email.html, /21:30/);
        assert.match(email.text, /\/settings/);
        if (kind === 'email_changed') {
          // The old address can't reset anything any more: it gets "secure your account" instead.
          assert.doesNotMatch(email.html, /forgot-password/);
        } else {
          assert.match(email.html, /\/forgot-password"/);
        }
      });
    }
  }

  test('an email change shows only the masked new address', () => {
    const email = noticeEmail('email_changed', { name: 'Sami', at: new Date(), maskedNewEmail: 'sa••••@gmail.com' }, 'en');
    assert.match(email.html, /sa••••@gmail\.com/);
    assert.match(email.text, /sa••••@gmail\.com/);
  });
});

describe('welcome email', () => {
  test('subjects follow each language', () => {
    assert.equal(welcomeEmail('Sami', 'en').subject, 'Welcome to TG Hub, Sami!');
    assert.equal(welcomeEmail('Sami', 'fr').subject, 'Bienvenue sur TG Hub, Sami !');
    assert.match(welcomeEmail('Sami', 'ar').subject, /⁨Sami⁩/);
    for (const locale of LOCALES) assertClean(welcomeEmail('Sami', locale));
  });
});

test('Outlook gets a fixed-width ghost table and padded buttons', () => {
  const { html } = noticeEmail('password_changed', { name: 'Sami', at: new Date() }, 'en');
  assert.match(html, /<!--\[if mso\]><table role="presentation" width="560"/);
  assert.match(html, /mso-padding-alt:13px 26px/);
});

test('names are escaped, never rendered as HTML', () => {
  const name = '<img src=x onerror=alert(1)>"&';
  for (const email of [codeEmail('password_reset', name, '482913', 'en'), noticeEmail('password_changed', { name, at: new Date() }, 'fr'), welcomeEmail(name, 'ar')]) {
    assert.doesNotMatch(email.html, /<img src=x/);
    assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&amp;/);
  }
});
