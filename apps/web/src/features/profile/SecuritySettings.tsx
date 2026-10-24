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
import { api, ApiError } from '@/lib/api/client';
import { ConnectionsCard } from './ConnectionsCard';
import styles from './SecuritySettings.module.css';

function EmailCard({ me }: { me: Me }) {
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
          <h3>Email</h3>
          <p>
            {me.email} {me.emailVerified ? <Tag tone="success">Confirmed</Tag> : <Tag tone="gold">Not confirmed</Tag>}
          </p>
        </div>
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        ) : null}
      </header>
      {done ? <p className={styles.ok}>Email changed. We let your old address know.</p> : null}

      {open && !pending ? (
        <form
          className={styles.form}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            start.mutate();
          }}
          noValidate
        >
          <TextField label="New email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={startFields.email} />
          <TextField label="Current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={startFields.password} />
          <FormError message={start.error && Object.keys(startFields).length === 0 ? start.error.message : null} />
          <div className={styles.actions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={start.isPending} disabled={!email.includes('@') || !password}>
              Send code to new email
            </Button>
          </div>
        </form>
      ) : null}

      {pending ? (
        <div className={styles.form}>
          <p className={styles.text}>
            Enter the code we sent to <strong>{pending.email}</strong>. Your email changes only after this step.
          </p>
          {pending.devCode ? (
            <p className={styles.dev}>
              Development mode — your code is <strong>{pending.devCode}</strong>
            </p>
          ) : null}
          <CodeInput value={code} onChange={setCode} onComplete={(value) => confirm.mutate(value)} invalid={Boolean(confirmError)} disabled={confirm.isPending} />
          {confirmError ? <p className={styles.error}>{confirmError}</p> : null}
          <div className={styles.actions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
              Back
            </Button>
            <Button size="sm" loading={confirm.isPending} disabled={code.length !== CODE_LENGTH} onClick={() => confirm.mutate(code)}>
              Confirm new email
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PasswordCard() {
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
          <h3>Password</h3>
          <p>Changing it signs out every other device.</p>
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
        <TextField label="Current password" type="password" autoComplete="current-password" value={values.currentPassword} onChange={set('currentPassword')} error={fields.currentPassword} />
        <div className={styles.row}>
          <TextField label="New password" type="password" autoComplete="new-password" value={values.newPassword} onChange={set('newPassword')} error={fields.newPassword} hint="At least 8 characters." />
          <TextField label="Repeat new password" type="password" autoComplete="new-password" value={values.repeat} onChange={set('repeat')} error={mismatch ? "The passwords don't match" : undefined} />
        </div>
        <FormError message={change.error && Object.keys(fields).length === 0 ? change.error.message : null} />
        <div className={styles.actions}>
          {saved ? <span className={styles.ok}>Password changed. Other devices were signed out.</span> : null}
          <Button type="submit" size="sm" loading={change.isPending} disabled={!values.currentPassword || values.newPassword.length < 8 || mismatch}>
            Change password
          </Button>
        </div>
      </form>
    </section>
  );
}

function DevicesCard() {
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
          <h3>Where you&apos;re signed in</h3>
          <p>Don&apos;t recognise a device? Sign it out and change your password.</p>
        </div>
        {others > 0 ? (
          <Button variant="outline" size="sm" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
            Sign out others
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
                  {session.device} {session.current ? <Tag tone="primary">This device</Tag> : null}
                </strong>
                <span>
                  {session.ip || 'Unknown IP'} · active <RelativeTime iso={session.lastUsedAt} />
                </span>
              </span>
              {!session.current ? (
                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(session.id)} loading={revoke.isPending && revoke.variables === session.id}>
                  Sign out
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
  return (
    <SignedIn prompt="Sign in to manage your account" loading={<Skeleton height={240} />}>
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
