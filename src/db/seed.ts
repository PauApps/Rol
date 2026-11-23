import { eq } from 'drizzle-orm';
import { auditLogs, gameSystems, users } from './schema';
import type { AppDatabase } from './types';
import { hashPassword } from '@/server/auth/crypto';

export async function seedGameSystems(db: AppDatabase): Promise<void> {
  await db
    .insert(gameSystems)
    .values({
      id: 'dnd5e-2014',
      name: 'Dungeons & Dragons 5a edició (2014)',
      shortName: 'D&D 5e (2014)',
      version: '2014',
      isActive: true,
    })
    .onConflictDoNothing({ target: gameSystems.id });
}

export async function seedInitialAdmin(
  db: AppDatabase,
  options?: {
    email?: string;
    password?: string;
    displayName?: string;
  }
): Promise<{ created: boolean; email?: string }> {
  const existingAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  if (existingAdmins.length > 0) {
    return { created: false };
  }

  const isProd = process.env.NODE_ENV === 'production';
  const email = (
    options?.email ??
    process.env.ROL_ADMIN_EMAIL ??
    (isProd ? '' : 'admin@rol.local')
  )
    .trim()
    .toLowerCase();
  const password =
    options?.password ??
    process.env.ROL_ADMIN_PASSWORD ??
    (isProd ? '' : 'CanviaAquestaContrasenya123!');
  const displayName = (
    options?.displayName ??
    process.env.ROL_ADMIN_NAME ??
    'Administrador Principal'
  ).trim();

  if (!email || !password) {
    throw new Error(
      'Falten ROL_ADMIN_EMAIL i ROL_ADMIN_PASSWORD per inicialitzar l’administrador principal en producció.'
    );
  }

  const passwordHash = await hashPassword(password);

  const [createdAdmin] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName,
      role: 'admin',
      status: 'active',
      preferredLocale: 'ca',
    })
    .returning({ id: users.id, email: users.email });

  await db.insert(auditLogs).values({
    actorUserId: createdAdmin.id,
    action: 'admin.bootstrap',
    targetType: 'user',
    targetId: createdAdmin.id,
    metadata: { email: createdAdmin.email },
  });

  return { created: true, email: createdAdmin.email };
}

export async function ensureBaseSeed(db: AppDatabase): Promise<void> {
  await seedGameSystems(db);
  await seedInitialAdmin(db);
}
