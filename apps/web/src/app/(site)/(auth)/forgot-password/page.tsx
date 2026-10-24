import type { Metadata } from 'next';
import { ForgotPasswordFlow } from '@/features/auth/ForgotPasswordFlow';
import { AuthLayout } from '../AuthLayout';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default async function ForgotPasswordPage(props: PageProps<'/forgot-password'>) {
  const { email } = await props.searchParams;
  return (
    <AuthLayout
      kicker="Account / Recover"
      title={
        <>
          Back in
          <br />
          the <em>game</em>.
        </>
      }
    >
      <ForgotPasswordFlow initialEmail={typeof email === 'string' ? email : ''} />
    </AuthLayout>
  );
}
