import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { getServerAuthContext } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const ctx = await getServerAuthContext();
  if (ctx) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm />
    </main>
  );
}
