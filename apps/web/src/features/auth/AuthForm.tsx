'use client';

import type { CountryCode, TnGovernorate } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextField } from '@/components/ui/Field';
import { HomeFields } from '@/features/profile/HomeFields';
import { api, ApiError } from '@/lib/api/client';
import { useT } from '@/i18n/I18nProvider';
import { DiscordButton, oauthErrorMessage } from './oauth';
import oauthStyles from './oauth.module.css';
import { SESSION_KEY } from './session';
import { rememberVerification } from './verification';
import styles from './AuthForm.module.css';

type Mode = 'login' | 'register';

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/universe';
}

export function AuthForm({ mode, next, authError }: { mode: Mode; next?: string; authError?: string }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: api.auth.providers, staleTime: 10 * 60_000 });
  const [values, setValues] = useState({ identifier: '', email: '', username: '', password: '', country: 'TN', region: '' });
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? api.auth.login({ identifier: values.identifier, password: values.password })
        : api.auth.register({
            email: values.email,
            username: values.username,
            password: values.password,
            country: (values.country || undefined) as CountryCode | undefined,
            region: values.country === 'TN' ? ((values.region || undefined) as TnGovernorate | undefined) : undefined,
          }),
    onSuccess: (result) => {
      queryClient.setQueryData(SESSION_KEY, result.user);
      if (!result.user.emailVerified) {
        // New accounts confirm their email before anything else.
        if (result.verification) rememberVerification(result.verification);
        router.replace(`/verify-email?next=${encodeURIComponent(safeNext(next))}`);
        return;
      }
      router.replace(safeNext(next));
      router.refresh();
    },
  });

  const error = submit.error instanceof ApiError ? submit.error : null;
  const fields = error?.fields ?? {};
  const generalError = submit.error && Object.keys(fields).length === 0 ? submit.error.message : submit.isIdle ? oauthErrorMessage(authError) : null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit.mutate();
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <FormError message={generalError} />
      {providers.data?.discord ? (
        <>
          <DiscordButton next={safeNext(next)} label={mode === 'login' ? t.auth.continueDiscord : t.auth.signUpDiscord} />
          <p className={oauthStyles.divider}>{t.auth.orEmail}</p>
        </>
      ) : null}
      {mode === 'login' ? (
        <TextField
          label={t.auth.identifier}
          name="identifier"
          autoComplete="username"
          value={values.identifier}
          onChange={set('identifier')}
          error={fields.identifier}
          required
          autoFocus
        />
      ) : (
        <>
          <TextField label={t.auth.email} name="email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={fields.email} required autoFocus />
          <TextField
            label={t.auth.username}
            name="username"
            autoComplete="username"
            value={values.username}
            onChange={set('username')}
            error={fields.username}
            hint={t.auth.usernameHint}
            required
          />
        </>
      )}
      <TextField
        label={t.auth.password}
        name="password"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={values.password}
        onChange={set('password')}
        error={fields.password}
        hint={mode === 'register' ? t.auth.passwordHint : undefined}
        required
      />
      {mode === 'login' ? (
        <Link href={`/forgot-password${values.identifier.includes('@') ? `?email=${encodeURIComponent(values.identifier)}` : ''}`} className={styles.forgot}>
          {t.auth.forgot}
        </Link>
      ) : null}
      {mode === 'register' ? (
        <HomeFields
          value={{ country: values.country, region: values.region }}
          onChange={(home) => setValues((current) => ({ ...current, ...home }))}
          errors={fields}
          optional
        />
      ) : null}
      <Button type="submit" size="lg" block loading={submit.isPending} iconRight="arrowRight">
        {mode === 'login' ? t.auth.submitLogin : t.auth.submitRegister}
      </Button>
      <p className={styles.switch}>
        {mode === 'login' ? (
          <>
            {t.auth.newHere} <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{t.auth.createOne}</Link>
          </>
        ) : (
          <>
            {t.auth.already} <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{t.auth.submitLogin}</Link>
          </>
        )}
      </p>
    </form>
  );
}
