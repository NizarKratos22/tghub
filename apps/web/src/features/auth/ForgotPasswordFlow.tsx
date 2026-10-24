'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput';
import { FormError, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
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
          <h2>Reset your password</h2>
          <p>Enter the email on your account and we&apos;ll send you a 6-digit code.</p>
        </div>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={requestFields.email} required autoFocus />
        <FormError message={request.error && !requestFields.email ? request.error.message : null} />
        <Button type="submit" size="lg" block loading={request.isPending} disabled={!email.includes('@')}>
          Send code
        </Button>
        <p className={styles.resend}>
          <span>Remembered it?</span> <Link href="/login">Back to sign in</Link>
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
        <h2>Check your inbox</h2>
        <p>
          If <strong>{email}</strong> has a TG Hub account, a code is on its way. It expires in 15 minutes.
        </p>
      </div>
      {devCode ? (
        <p className={styles.dev}>
          <Icon name="code" size={16} />
          <span>
            Development mode — no email server is configured, so here is your code: <strong>{devCode}</strong>
          </span>
        </p>
      ) : null}
      <CodeInput value={code} onChange={setCode} invalid={Boolean(resetFields.code)} disabled={reset.isPending} />
      {resetFields.code ? (
        <p className={styles.error} role="alert">
          {resetFields.code}
        </p>
      ) : null}
      <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={resetFields.password} hint="At least 8 characters." />
      <TextField label="Repeat new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "The passwords don't match" : undefined} />
      <FormError message={reset.error && Object.keys(resetFields).length === 0 ? reset.error.message : null} />
      <Button type="submit" size="lg" block loading={reset.isPending} disabled={code.length !== CODE_LENGTH || password.length < 8 || mismatch}>
        Set new password
      </Button>
      <div className={styles.resend}>
        <span>No email? Check spam, or</span>
        <button type="button" onClick={() => request.mutate()} disabled={wait > 0 || request.isPending}>
          {request.isPending ? 'Sending…' : wait > 0 ? `send a new code in ${wait}s` : 'send a new code'}
        </button>
      </div>
      <p className={styles.resend}>
        <button type="button" onClick={() => setStep('email')}>
          Use a different email
        </button>
      </p>
    </form>
  );
}
