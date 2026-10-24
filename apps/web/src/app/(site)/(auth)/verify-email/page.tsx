import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/features/auth/VerifyEmailForm';
import { AuthLayout } from '../AuthLayout';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

/** Only same-site relative paths, like sign-in. */
function safeNext(value: string | string[] | undefined): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/universe';
}

export default async function VerifyEmailPage(props: PageProps<'/verify-email'>) {
  const { next } = await props.searchParams;
  return (
    <AuthLayout
      kicker="Account / Confirm"
      title={
        <>
          One last
          <br />
          <em>step</em>.
        </>
      }
    >
      <VerifyEmailForm next={safeNext(next)} />
    </AuthLayout>
  );
}
