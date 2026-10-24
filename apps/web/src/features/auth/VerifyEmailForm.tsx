'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { EmailVerificationStatus, Me } from '@tgh/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';
import { SESSION_KEY, SignedIn } from './session';
import { useSecondsUntil } from './useSecondsUntil';
import { forgetVerification, recallVerification, rememberVerification } from './verification';
import styles from './VerifyEmailForm.module.css';

function Verify({ me, next }: { me: Me; next: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<EmailVerificationStatus | null>(() => recallVerification());
  const [done, setDone] = useState(me.emailVerified);

  const remote = useQuery({ queryKey: ['auth', 'verification'], queryFn: api.auth.verification, enabled: !me.emailVerified });
  useEffect(() => {
    const data = remote.data;
    if (!data) return;
    if ('verified' in data) setDone(true);
    // Keep the dev code from sign-up if the server's status is about the same code.
    else setStatus((current) => (current && current.expiresAt === data.expiresAt ? current : data));
  }, [remote.data]);

  const verify = useMutation({
    mutationFn: (value: string) => api.auth.verifyEmail(value),
    onSuccess: (updated) => {
      forgetVerification();
      queryClient.setQueryData(SESSION_KEY, updated);
      setDone(true);
      window.setTimeout(() => router.replace(next), 1400);
    },
    onError: () => setCode(''),
  });
  const resend = useMutation({
    mutationFn: api.auth.resendCode,
    onSuccess: (result) => {
      if ('verified' in result) return setDone(true);
      rememberVerification(result);
      setStatus(result);
      setCode('');
      verify.reset();
    },
  });

  const wait = useSecondsUntil(status?.resendAt);
  const error = verify.error instanceof ApiError ? (verify.error.fields.code ?? verify.error.message) : verify.error ? 'Could not check the code — try again' : null;
  const resendError = resend.error instanceof ApiError ? resend.error.message : null;

  if (done) {
    return (
      <div className={styles.done}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={30} />
        </span>
        <h2>Email confirmed</h2>
        <p>You&apos;re all set — the marketplace and messaging are unlocked.</p>
        <ButtonLink href={next} iconRight="arrowRight">
          Continue
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === CODE_LENGTH) verify.mutate(code);
      }}
    >
      <span className={styles.icon}>
        <Icon name="message" size={26} />
      </span>
      <div className={styles.copy}>
        <h2>Enter the code we emailed you</h2>
        <p>
          We sent a 6-digit code to <strong>{status?.email ?? me.email}</strong>. It expires in 15 minutes.
        </p>
      </div>

      {status?.devCode ? (
        <p className={styles.dev}>
          <Icon name="code" size={16} />
          <span>
            Development mode — no email server is configured, so here is your code: <strong>{status.devCode}</strong>
          </span>
        </p>
      ) : null}

      <CodeInput value={code} onChange={setCode} onComplete={(value) => verify.mutate(value)} invalid={Boolean(error)} disabled={verify.isPending} />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" block loading={verify.isPending} disabled={code.length !== CODE_LENGTH}>
        Confirm email
      </Button>

      <div className={styles.resend}>
        <span>Didn&apos;t get it? Check spam, or</span>
        <button type="button" onClick={() => resend.mutate()} disabled={wait > 0 || resend.isPending}>
          {resend.isPending ? 'Sending…' : wait > 0 ? `send a new code in ${wait}s` : 'send a new code'}
        </button>
      </div>
      <FormError message={resendError} />
    </form>
  );
}

export function VerifyEmailForm({ next }: { next: string }) {
  return (
    <SignedIn prompt="Sign in to confirm your email" loading={<Skeleton height={320} />}>
      {(me) => <Verify me={me} next={next} />}
    </SignedIn>
  );
}
