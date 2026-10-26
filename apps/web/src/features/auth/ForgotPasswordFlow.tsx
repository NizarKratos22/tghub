'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput';
import { FormError, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { SESSION_KEY } from './session';
import { useSecondsUntil } from './useSecondsUntil';
import styles from './VerifyEmailForm.module.css';

const RESEND_SECONDS = 60;

/**
 * Two steps on one page: ask for the email, then take the code plus a new
 * password. Success signs the player in on this device.
 */
export function ForgotPasswordFlow({ initialEmail = '' }: { initialEmail?: string }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | undefined>();
  const wait = useSecondsUntil(resendAt);

  const request = useMutation({
    mutationFn: () => api.auth.forgotPassword(email.trim()),
    onSuccess: (result) => {
      setDevCode(result.devCode ?? null);
      setResendAt(new Date(Date.now() + RESEND_SECONDS * 1000).toISOString());
      setStep('reset');
    },
  });
  const reset = useMutation({
    mutationFn: () => api.auth.resetPassword({ email: email.trim(), code, password }),
    onSuccess: (result) => {
      queryClient.setQueryData(SESSION_KEY, result.user);
      router.replace('/universe');
      router.refresh();
    },
  });

  const requestFields = request.error instanceof ApiError ? request.error.fields : {};
  const resetFields = reset.error instanceof ApiError ? reset.error.fields : {};
  const mismatch = confirm.length > 0 && confirm !== password;

  if (step === 'email') {
    return (
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate();
        }}
        noValidate
      >
        <span className={styles.icon}>
          <Icon name="lock" size={26} />
        </span>
        <div className={styles.copy}>
          <h2>{t.recover.title}</h2>
          <p>{t.recover.text}</p>
        </div>
        <TextField label={t.auth.email} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={requestFields.email} required autoFocus />
        <FormError message={request.error && !requestFields.email ? request.error.message : null} />
        <Button type="submit" size="lg" block loading={request.isPending} disabled={!email.includes('@')}>
          {t.recover.sendCode}
        </Button>
        <p className={styles.resend}>
          <span>{t.recover.remembered}</span> <Link href="/login">{t.recover.backToSignIn}</Link>
        </p>
      </form>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH && !mismatch) reset.mutate();
      }}
      noValidate
    >
      <span className={styles.icon}>
        <Icon name="message" size={26} />
      </span>
      <div className={styles.copy}>
        <h2>{t.recover.checkInbox}</h2>
        <p>{fill(t.recover.codeSent, { email })}</p>
      </div>
      {devCode ? (
        <p className={styles.dev}>
          <Icon name="code" size={16} />
          <span>
            {t.recover.devCode} <strong>{devCode}</strong>
          </span>
        </p>
      ) : null}
      <CodeInput value={code} onChange={setCode} invalid={Boolean(resetFields.code)} disabled={reset.isPending} />
      {resetFields.code ? (
        <p className={styles.error} role="alert">
          {resetFields.code}
        </p>
      ) : null}
      <TextField label={t.security.newPassword} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={resetFields.password} hint={t.security.passwordHint} />
      <TextField label={t.security.repeatPassword} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? t.security.mismatch : undefined} />
      <FormError message={reset.error && Object.keys(resetFields).length === 0 ? reset.error.message : null} />
      <Button type="submit" size="lg" block loading={reset.isPending} disabled={code.length !== CODE_LENGTH || password.length < 8 || mismatch}>
        {t.recover.setPassword}
      </Button>
      <div className={styles.resend}>
        <span>{t.recover.noEmail}</span>
        <button type="button" onClick={() => request.mutate()} disabled={wait > 0 || request.isPending}>
          {request.isPending ? t.recover.sending : wait > 0 ? fill(t.recover.resendIn, { seconds: wait }) : t.recover.resend}
        </button>
      </div>
      <p className={styles.resend}>
        <button type="button" onClick={() => setStep('email')}>
          {t.recover.differentEmail}
        </button>
      </p>
    </form>
  );
}
