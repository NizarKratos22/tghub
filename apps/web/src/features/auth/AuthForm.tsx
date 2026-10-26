'use client';

import { usernameSchema, type CountryCode, type TnGovernorate } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { HomeFields } from '@/features/profile/HomeFields';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { useDebounced } from '@/lib/useDebounced';
import { checkPassword, emailSuggestion, looksLikeEmail } from './form-helpers';
import { DiscordButton, oauthErrorMessage } from './oauth';
import oauthStyles from './oauth.module.css';
import { SESSION_KEY } from './session';
import { rememberVerification } from './verification';
import styles from './AuthForm.module.css';

type Mode = 'login' | 'register';
type Values = { identifier: string; email: string; username: string; password: string; country: string; region: string };
type FieldName = 'identifier' | 'email' | 'username' | 'password';

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/universe';
}

/**
 * Sign in and sign up. Mistakes show as soon as a field is left (not while
 * typing), the username is checked as it's typed, the password shows its
 * strength, and the first field that needs attention gets the focus.
 */
export function AuthForm({ mode, next, authError }: { mode: Mode; next?: string; authError?: string }) {
  const t = useT();
  const words = t.auth;
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: api.auth.providers, staleTime: 10 * 60_000 });
  const [values, setValues] = useState<Values>({ identifier: '', email: '', username: '', password: '', country: 'TN', region: '' });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const set = (key: keyof Values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    // A server complaint about a field goes away once the field changes.
    if (serverFields[key]) setServerFields(({ [key]: _, ...rest }) => rest);
  };
  const leave = (name: FieldName) => () => setTouched((current) => ({ ...current, [name]: true }));

  // Username: rules first, then (once typing pauses) whether it's free.
  const username = values.username.trim();
  const usernameValid = mode === 'register' && usernameSchema.safeParse(username).success;
  const settledUsername = useDebounced(username, 400);
  const availability = useQuery({
    queryKey: ['auth', 'username-available', settledUsername.toLowerCase()],
    queryFn: () => api.auth.usernameAvailable(settledUsername),
    enabled: usernameValid && settledUsername === username,
    staleTime: 30_000,
  });
  const usernameTaken = usernameValid && settledUsername === username && availability.data?.available === false;

  const password = checkPassword(values.password, [username, values.email.split('@')[0] ?? '']);
  const suggestion = mode === 'register' ? emailSuggestion(values.email) : null;

  const clientErrors: Partial<Record<FieldName, string>> = {};
  if (mode === 'login') {
    if (values.identifier.trim().length < 3) clientErrors.identifier = words.errors.identifier;
    if (!values.password) clientErrors.password = words.errors.password;
  } else {
    if (!looksLikeEmail(values.email)) clientErrors.email = words.errors.email;
    if (!usernameValid) clientErrors.username = words.errors.username;
    else if (usernameTaken) clientErrors.username = fill(words.usernameTaken, { name: username });
    if (!password.rules.length) clientErrors.password = words.errors.passwordShort;
  }
  const errorFor = (name: FieldName) => serverFields[name] ?? (touched[name] || submitted || (name === 'username' && usernameTaken) ? clientErrors[name] : undefined);

  const submit = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? api.auth.login({ identifier: values.identifier, password: values.password })
        : api.auth.register({
            email: values.email.trim(),
            username,
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
    onError: (error) => {
      const fields = error instanceof ApiError ? error.fields : {};
      setServerFields(fields);
      focusFirst(Object.keys(fields));
    },
  });

  const focusFirst = (names: string[]) => {
    const order: string[] = mode === 'login' ? ['identifier', 'password'] : ['email', 'username', 'password', 'country', 'region'];
    const first = order.find((name) => names.includes(name));
    if (first) (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const problems = Object.keys(clientErrors);
    if (problems.length > 0) return focusFirst(problems);
    submit.mutate();
  };

  const watchCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'));
  const hasServerFields = Object.keys(serverFields).length > 0;
  const generalError = submit.error && !hasServerFields ? submit.error.message : submit.isIdle ? oauthErrorMessage(authError, t) : null;

  const usernameHint =
    !username || !usernameValid ? (
      words.usernameHint
    ) : availability.isFetching || settledUsername !== username ? (
      <span className={styles.checking}>{words.checking}</span>
    ) : availability.data?.available ? (
      <span className={styles.ok}>
        <Icon name="check" size={13} /> {fill(words.usernameFree, { name: username })}
      </span>
    ) : (
      words.usernameHint
    );

  return (
    <form ref={form} className={styles.form} onSubmit={onSubmit} noValidate>
      <FormError message={generalError} />
      {providers.data?.discord ? (
        <>
          <DiscordButton next={safeNext(next)} label={mode === 'login' ? words.continueDiscord : words.signUpDiscord} />
          <p className={oauthStyles.divider}>{words.orEmail}</p>
        </>
      ) : null}

      {mode === 'login' ? (
        <TextField
          label={words.identifier}
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={values.identifier}
          onChange={set('identifier')}
          onBlur={leave('identifier')}
          error={errorFor('identifier')}
          required
          autoFocus
        />
      ) : (
        <>
          <TextField
            label={words.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={set('email')}
            onBlur={leave('email')}
            error={errorFor('email')}
            hint={
              suggestion ? (
                <button type="button" className={styles.suggest} onClick={() => setValues((current) => ({ ...current, email: suggestion }))}>
                  {fill(words.didYouMean, { email: suggestion })}
                </button>
              ) : undefined
            }
            required
            autoFocus
          />
          <TextField
            label={words.username}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={values.username}
            onChange={set('username')}
            onBlur={leave('username')}
            error={errorFor('username')}
            hint={usernameHint}
            required
          />
        </>
      )}

      <div className={styles.passwordBlock}>
        <TextField
          label={words.password}
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={values.password}
          onChange={set('password')}
          onBlur={leave('password')}
          onKeyDown={watchCaps}
          onKeyUp={watchCaps}
          error={errorFor('password')}
          hint={capsLock ? <span className={styles.caps}>{words.capsLock}</span> : undefined}
          required
          end={
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? words.hidePassword : words.showPassword}
              aria-pressed={showPassword}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          }
        />
        {mode === 'login' ? (
          <Link href={`/forgot-password${values.identifier.includes('@') ? `?email=${encodeURIComponent(values.identifier)}` : ''}`} className={styles.forgot}>
            {words.forgot}
          </Link>
        ) : values.password ? (
          <div className={styles.strength} aria-live="polite">
            <div className={cx(styles.meter, styles[`score${password.score}`])} aria-hidden>
              {[1, 2, 3, 4].map((step) => (
                <span key={step} className={step <= password.score ? styles.lit : undefined} />
              ))}
            </div>
            <p className={styles.strengthLabel}>
              {words.strength}: <strong>{words.strengthLevels[password.score]}</strong>
            </p>
            <ul className={styles.rules}>
              {(['length', 'mixedCase', 'numberOrSymbol'] as const).map((rule) => (
                <li key={rule} className={password.rules[rule] ? styles.ruleMet : undefined}>
                  <Icon name={password.rules[rule] ? 'check' : 'info'} size={13} />
                  {words.rules[rule]}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.quiet}>{words.passwordHint}</p>
        )}
      </div>

      {mode === 'register' ? (
        <HomeFields
          value={{ country: values.country, region: values.region }}
          onChange={(home) => setValues((current) => ({ ...current, ...home }))}
          errors={serverFields}
          optional
        />
      ) : null}

      <Button type="submit" size="lg" block loading={submit.isPending} iconRight="arrowRight">
        {mode === 'login' ? words.submitLogin : words.submitRegister}
      </Button>
      {mode === 'register' ? <p className={styles.fine}>{words.registerNote}</p> : null}
    </form>
  );
}
