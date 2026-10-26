import type { Metadata } from 'next';
import { ForgotPasswordFlow } from '@/features/auth/ForgotPasswordFlow';
import { getT } from '@/i18n/server';
import { AuthLayout } from '../AuthLayout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.recover.metaTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage(props: PageProps<'/forgot-password'>) {
  const [{ email }, t] = await Promise.all([props.searchParams, getT()]);
  const [line, lead, em, after] = t.recover.pageTitle;
  return (
    <AuthLayout
      kicker={t.recover.kicker}
      title={
        <>
          {line}
          <br />
          {lead} <em>{em}</em>
          {after}
        </>
      }
    >
      <ForgotPasswordFlow initialEmail={typeof email === 'string' ? email : ''} />
    </AuthLayout>
  );
}
