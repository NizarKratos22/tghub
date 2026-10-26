import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/AuthForm';
import { getT } from '@/i18n/server';
import { AuthLayout } from '../AuthLayout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.register };
}

export default async function RegisterPage(props: PageProps<'/register'>) {
  const { next, auth_error: authError } = await props.searchParams;
  const t = await getT();
  return (
    <AuthLayout
      mode="register"
      next={typeof next === 'string' ? next : undefined}
      kicker={t.auth.registerKicker}
      title={
        <>
          {t.auth.registerTitle[0]}
          <br />
          <em>{t.auth.registerTitle[1]}</em>
          {t.auth.registerTitle[2]}
        </>
      }
    >
      <AuthForm mode="register" next={typeof next === 'string' ? next : undefined} authError={typeof authError === 'string' ? authError : undefined} />
    </AuthLayout>
  );
}
