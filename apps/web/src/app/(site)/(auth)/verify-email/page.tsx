import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/features/auth/VerifyEmailForm';
import { getT } from '@/i18n/server';
import { AuthLayout } from '../AuthLayout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.recover.verifyMetaTitle, robots: { index: false } };
}

/** Only same-site relative paths, like sign-in. */
function safeNext(value: string | string[] | undefined): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/universe';
}

export default async function VerifyEmailPage(props: PageProps<'/verify-email'>) {
  const [{ next }, t] = await Promise.all([props.searchParams, getT()]);
  const [line, lead, em, after] = t.recover.verifyPageTitle;
  return (
    <AuthLayout
      kicker={t.recover.verifyKicker}
      title={
        <>
          {line}
          <br />
          {lead ? `${lead} ` : null}
          <em>{em}</em>
          {after}
        </>
      }
    >
      <VerifyEmailForm next={safeNext(next)} />
    </AuthLayout>
  );
}
