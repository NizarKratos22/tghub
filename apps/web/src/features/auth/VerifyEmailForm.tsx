'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EmailVerificationStatus, Me } from '@tgh/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { SESSION_KEY, SignedIn } from './session';
import { useSecondsUntil } from './useSecondsUntil';
import { forgetVerification, recallVerification, rememberVerification } from './verification';
import styles from './VerifyEmailForm.module.css';

function Verify({ me, next }: { me: Me; next: string }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<EmailVerificationStatus | null>(() => recallVerification());
  const [done, setDone] = useState(me.emailVerified);

  const remote = useQuery({ queryKey: ['auth', 'verification'], queryFn: api.auth.verification, enabled: !me.emailVerified });
  // Follow the server's answer each time a new one arrives.
  const [handled, setHandled] = useState<typeof remote.data>(undefined);
  if (remote.data !== handled) {
    const data = remote.data;
    setHandled(data);
    if (data && 'verified' in data) setDone(true);
    // Keep the dev code from sign-up if the server's status is about the same code.
    else if (data) setStatus((current) => (current && current.expiresAt === data.expiresAt ? current : data));
  }

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
  const error = verify.error instanceof ApiError ? (verify.error.fields.code ?? verify.error.message) : verify.error ? t.recover.checkFailed : null;
  const resendError = resend.error instanceof ApiError ? resend.error.message : null;

  if (done) {
    return (
      <div className={styles.done}>
        <span className={styles.doneIcon}>
          <Icon name="check" size={30} />
        </span>
        <h2>{t.recover.confirmed}</h2>
        <p>{t.recover.confirmedText}</p>
        <ButtonLink href={next} iconRight="arrowRight">
          {t.recover.continue}
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
        <h2>{t.recover.verifyTitle}</h2>
        <p>{fill(t.recover.verifyText, { email: status?.email ?? me.email })}</p>
      </div>

      {status?.devCode ? (
        <p className={styles.dev}>
          <Icon name="code" size={16} />
          <span>
            {t.recover.devCode} <strong>{status.devCode}</strong>
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
        {t.recover.confirm}
      </Button>

      <div className={styles.resend}>
        <span>{t.recover.didntGet}</span>
        <button type="button" onClick={() => resend.mutate()} disabled={wait > 0 || resend.isPending}>
          {resend.isPending ? t.recover.sending : wait > 0 ? fill(t.recover.resendIn, { seconds: wait }) : t.recover.resend}
        </button>
      </div>
      <FormError message={resendError} />
    </form>
  );
}

export function VerifyEmailForm({ next }: { next: string }) {
  const t = useT();
  return (
    <SignedIn prompt={t.recover.signInToConfirm} loading={<Skeleton height={320} />}>
      {(me) => <Verify me={me} next={next} />}
    </SignedIn>
  );
}
