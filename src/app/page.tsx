import { redirect } from 'next/navigation';
import { getServerAuthContext } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const ctx = await getServerAuthContext();

  if (!ctx) {
    redirect('/login');
  }

  if (ctx.kind === 'guest') {
    redirect(`/campaigns/${ctx.member.campaignId}`);
  }

  if (ctx.user.role === 'admin') {
    redirect('/admin');
  }

  redirect('/campaigns');
}
