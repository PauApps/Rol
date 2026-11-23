import type { AppDatabase } from '@/db/types';
import { seedInitialAdmin } from '@/db/seed';
import { resolveSession, type AuthContext } from '@/server/auth/session';
import { createGmInvitation } from '@/server/services/admin-service';
import { loginWithPassword, registerGmWithInvitation } from '@/server/services/auth-service';

export async function bootstrapAdmin(db: AppDatabase) {
  await seedInitialAdmin(db, {
    email: 'admin@rol.test',
    password: 'AdminPassword123!',
    displayName: 'Admin Principal',
  });

  const login = await loginWithPassword(db, {
    email: 'admin@rol.test',
    password: 'AdminPassword123!',
  });

  const ctx = await resolveSession(db, login.rawToken);
  if (!ctx) {
    throw new Error('Failed to bootstrap admin session in test.');
  }

  return { ctx, rawToken: login.rawToken, user: login.user };
}

export async function createInvitedGm(
  db: AppDatabase,
  adminCtx: AuthContext,
  email: string,
  displayName: string,
  password = 'GmPassword123!'
) {
  const invite = await createGmInvitation(db, adminCtx, { email });
  const registered = await registerGmWithInvitation(db, {
    rawToken: invite.rawToken,
    email,
    displayName,
    password,
  });

  const ctx = await resolveSession(db, registered.rawToken);
  if (!ctx) {
    throw new Error('Failed to resolve GM session in test.');
  }

  return {
    user: registered.user,
    rawToken: registered.rawToken,
    ctx,
  };
}
