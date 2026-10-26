'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useState, type FormEvent } from 'react';
import type { EmailVerificationStatus, Me } from '@tgh/shared';
import { Button } from '@/components/ui/Button';
import { CODE_LENGTH, CodeInput } from '@/components/ui/CodeInput';
import { FormError, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { ConnectionsCard } from './ConnectionsCard';
import styles from './SecuritySettings.module.css';

function EmailCard({ me }: { me: Me }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<EmailVerificationStatus | null>(null);
  const [done, setDone] = useState(false);

  const start = useMutation({
    mutationFn: () => api.me.changeEmail({ email: email.trim(), password }),
    onSuccess: (status) => {
      setPending(status);
      setCode('');
    },
  });
  const confirm = useMutation({
    mutationFn: (value: string) => api.me.confirmEmail(value),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      setDone(true);
      setOpen(false);
      setPending(null);
      setEmail('');
      setPassword('');
    },
    onError: () => setCode(''),
  });

  const startFields = start.error instanceof ApiError ? start.error.fields : {};
  const confirmError = confirm.error instanceof ApiError ? (confirm.error.fields.code ?? confirm.error.message) : null;

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <span className={styles.icon}>
          <Icon name="message" size={18} />
        </span>
        <div>
          <h3>{t.security.email}</h3>
          <p>
            {me.email} {me.emailVerified ? <Tag tone="success">{t.security.confirmed}</Tag> : <Tag tone="gold">{t.security.notConfirmed}</Tag>}
          </p>
        </div>
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t.security.change}
          </Button>
        ) : null}
      </header>
      {done ? <p className={styles.ok}>{t.security.emailChanged}</p> : null}

      {open && !pending ? (
        <form
          className={styles.form}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            start.mutate();
          }}
          noValidate
        >
          <TextField label={t.security.newEmail} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={startFields.email} />
          <TextField label={t.security.currentPassword} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={startFields.password} />
          <FormError message={start.error && Object.keys(startFields).length === 0 ? start.error.message : null} />
          <div className={styles.actions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" size="sm" loading={start.isPending} disabled={!email.includes('@') || !password}>
              {t.security.sendCode}
            </Button>
          </div>
        </form>
      ) : null}

      {pending ? (
        <div className={styles.form}>
          <p className={styles.text}>{fill(t.security.enterCode, { email: pending.email })}</p>
          {pending.devCode ? <p className={styles.dev}>{fill(t.security.devCode, { code: pending.devCode })}</p> : null}
          <CodeInput value={code} onChange={setCode} onComplete={(value) => confirm.mutate(value)} invalid={Boolean(confirmError)} disabled={confirm.isPending} />
          {confirmError ? <p className={styles.error}>{confirmError}</p> : null}
          <div className={styles.actions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
              {t.security.back}
            </Button>
            <Button size="sm" loading={confirm.isPending} disabled={code.length !== CODE_LENGTH} onClick={() => confirm.mutate(code)}>
              {t.security.confirmEmail}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PasswordCard() {
  const t = useT();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [saved, setSaved] = useState(false);
  const change = useMutation({
    mutationFn: () => api.me.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      setSaved(true);
      setValues({ currentPassword: '', newPassword: '', repeat: '' });
      void queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] });
    },
  });
  const fields = change.error instanceof ApiError ? change.error.fields : {};
  const mismatch = values.repeat.length > 0 && values.repeat !== values.newPassword;
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <span className={styles.icon}>
          <Icon name="lock" size={18} />
        </span>
        <div>
          <h3>{t.security.password}</h3>
          <p>{t.security.passwordText}</p>
        </div>
      </header>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) change.mutate();
        }}
        noValidate
      >
        <TextField label={t.security.currentPassword} type="password" autoComplete="current-password" value={values.currentPassword} onChange={set('currentPassword')} error={fields.currentPassword} />
        <div className={styles.row}>
          <TextField label={t.security.newPassword} type="password" autoComplete="new-password" value={values.newPassword} onChange={set('newPassword')} error={fields.newPassword} hint={t.security.passwordHint} />
          <TextField label={t.security.repeatPassword} type="password" autoComplete="new-password" value={values.repeat} onChange={set('repeat')} error={mismatch ? t.security.mismatch : undefined} />
        </div>
        <FormError message={change.error && Object.keys(fields).length === 0 ? change.error.message : null} />
        <div className={styles.actions}>
          {saved ? <span className={styles.ok}>{t.security.passwordChanged}</span> : null}
          <Button type="submit" size="sm" loading={change.isPending} disabled={!values.currentPassword || values.newPassword.length < 8 || mismatch}>
            {t.security.changePassword}
          </Button>
        </div>
      </form>
    </section>
  );
}

function DevicesCard() {
  const t = useT();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: api.me.sessions });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] });
  const revoke = useMutation({ mutationFn: (id: string) => api.me.revokeSession(id), onSuccess: refresh });
  const revokeOthers = useMutation({ mutationFn: api.me.revokeOtherSessions, onSuccess: refresh });
  const others = (sessions.data ?? []).filter((session) => !session.current).length;

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <span className={styles.icon}>
          <Icon name="monitor" size={18} />
        </span>
        <div>
          <h3>{t.security.devices}</h3>
          <p>{t.security.devicesText}</p>
        </div>
        {others > 0 ? (
          <Button variant="outline" size="sm" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
            {t.security.signOutOthers}
          </Button>
        ) : null}
      </header>
      {sessions.isPending ? (
        <Skeleton height={120} />
      ) : (
        <ul className={styles.devices}>
          {(sessions.data ?? []).map((session) => (
            <li key={session.id}>
              <span className={styles.deviceIcon}>
                <Icon name={/android|iphone|ipad/i.test(session.device) ? 'gamepad' : 'monitor'} size={18} />
              </span>
              <span className={styles.deviceText}>
                <strong>
                  {session.device} {session.current ? <Tag tone="primary">{t.security.thisDevice}</Tag> : null}
                </strong>
                <span>
                  {session.ip || t.security.unknownIp} · {t.security.active} <RelativeTime iso={session.lastUsedAt} />
                </span>
              </span>
              {!session.current ? (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(session.id)} loading={revoke.isPending && revoke.variables === session.id}>
                  {t.security.signOut}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SecuritySettings() {
  const t = useT();
  return (
    <SignedIn prompt={t.security.signInPrompt} loading={<Skeleton height={240} />}>
      {(me) => (
        <div className={styles.stack}>
          <EmailCard me={me} />
          <PasswordCard />
          <Suspense fallback={<Skeleton height={180} />}>
            <ConnectionsCard />
          </Suspense>
          <DevicesCard />
        </div>
      )}
    </SignedIn>
  );
}
