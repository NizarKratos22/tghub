import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/AuthForm';
import { getT } from '@/i18n/server';
import { AuthLayout } from '../AuthLayout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.signIn };
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const { next, auth_error: authError } = await props.searchParams;
  const t = await getT();
  return (
    <AuthLayout
      mode="login"
      next={typeof next === 'string' ? next : undefined}
      kicker={t.auth.loginKicker}
      title={
        <>
          {t.auth.loginTitle[0]}
          <br />
          <em>{t.auth.loginTitle[1]}</em>
          {t.auth.loginTitle[2]}
        </>
      }
    >
      <AuthForm mode="login" next={typeof next === 'string' ? next : undefined} authError={typeof authError === 'string' ? authError : undefined} />
    </AuthLayout>
  );
}
