import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { AppShell } from '@/components/layout/AppShell';
import { AdminDashboardClient } from '@/components/admin/AdminDashboardClient';
import { getServerAuthContext } from '@/server/auth/session';
import {
  listAuditLogs,
  listGmInvitations,
  listUsers,
} from '@/server/services/admin-service';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect('/login');
  }
  if (ctx.kind !== 'user' || ctx.user.role !== 'admin') {
    redirect('/');
  }

  const db = await getDb();
  const [invitations, users, logs] = await Promise.all([
    listGmInvitations(db, ctx),
    listUsers(db, ctx),
    listAuditLogs(db, ctx, 30),
  ]);

  return (
    <AppShell
      actor={{
        kind: 'user',
        displayName: ctx.user.displayName,
        roleLabel: 'Administrador principal',
        role: 'admin',
      }}
      pageTitle="Administració principal"
      pageSubtitle="Control d’invitacions de GM, comptes de la plataforma i registre d’auditoria."
    >
      <AdminDashboardClient
        currentAdminId={ctx.user.id}
        initialInvitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          note: i.note,
          usedAt: i.usedAt ? i.usedAt.toISOString() : null,
          revokedAt: i.revokedAt ? i.revokedAt.toISOString() : null,
          createdAt: i.createdAt.toISOString(),
        }))}
        initialUsers={users.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
        }))}
        initialLogs={logs.map((l) => ({
          id: l.id,
          action: l.action,
          targetType: l.targetType,
          targetId: l.targetId,
          createdAt: l.createdAt.toISOString(),
          metadata: l.metadata,
        }))}
      />
    </AppShell>
  );
}
