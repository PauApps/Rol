import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeAppDb,
  getDb,
  isProductionRuntime,
  resolveDatabaseConfig,
  resolveMigrationDatabaseConfig,
} from '@/db';
import { getMigrationsFolder } from '@/db/config';
import { applyLockedMigrationsAndSeed } from '@/db/migrate';
import * as schema from '@/db/schema';
import { users } from '@/db/schema';

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void> | void
): Promise<void> {
  const keys = ['NODE_ENV', 'DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'VERCEL', 'VERCEL_ENV'];
  const backup: Record<string, string | undefined> = {};
  for (const k of keys) {
    backup[k] = process.env[k];
  }

  return Promise.resolve()
    .then(async () => {
      for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = v;
        }
      }
      await fn();
    })
    .finally(async () => {
      await closeAppDb();
      for (const k of keys) {
        if (backup[k] === undefined) {
          delete process.env[k];
        } else {
          process.env[k] = backup[k];
        }
      }
    });
}

describe('Protecció de base de dades en producció, local i migracions amb bloqueig', () => {
  afterEach(async () => {
    await closeAppDb();
  });

  it('exigeix DATABASE_URL en producció i bloqueja qualsevol fallback a PGlite', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: undefined,
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        expect(isProductionRuntime(process.env)).toBe(true);
        expect(() => resolveDatabaseConfig(process.env)).toThrow(/DATABASE_URL/);
        await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
      }
    );

    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: '   ',
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        expect(() => resolveDatabaseConfig(process.env)).toThrow(/DATABASE_URL/);
        await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
      }
    );

    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'pglite://./data/rol-dev',
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        expect(() => resolveDatabaseConfig(process.env)).toThrow(/PGlite/);
        await expect(getDb()).rejects.toThrow(/PGlite/);
      }
    );
  });

  it('bloqueja PGlite o DATABASE_URL absent també quan s’executa a Vercel (VERCEL=1)', async () => {
    await withEnv(
      {
        NODE_ENV: 'development',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        DATABASE_URL: undefined,
      },
      async () => {
        expect(isProductionRuntime(process.env)).toBe(true);
        expect(() => resolveDatabaseConfig(process.env)).toThrow(/DATABASE_URL/);
        await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
      }
    );

    await withEnv(
      {
        NODE_ENV: 'development',
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        DATABASE_URL: 'pglite://./data/rol-preview',
      },
      async () => {
        expect(() => resolveDatabaseConfig(process.env)).toThrow(/PGlite/);
        await expect(getDb()).rejects.toThrow(/PGlite/);
      }
    );
  });

  it('rebutja esquemes no PostgreSQL en producció sense exposar credencials a l’error', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://usuari:secretpass123@db.exemple.internal:3306/rol',
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      async () => {
        let caught: Error | null = null;
        try {
          resolveDatabaseConfig(process.env);
        } catch (err) {
          caught = err as Error;
        }
        expect(caught).not.toBeNull();
        expect(caught!.message).toMatch(/PostgreSQL/);
        expect(caught!.message).not.toContain('secretpass123');
        expect(caught!.message).not.toContain('usuari');
      }
    );
  });

  it('accepta postgres:// i postgresql:// en producció i prioritza DATABASE_URL_UNPOOLED per a migracions', async () => {
    const pooledUrl = 'postgresql://neondb_owner:pass@ep-cool-pooler.neon.tech/neondb?sslmode=require';
    const directUrl = 'postgres://neondb_owner:pass@ep-cool.neon.tech/neondb?sslmode=require';

    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: directUrl,
        VERCEL: '1',
        VERCEL_ENV: 'production',
      },
      () => {
        expect(resolveDatabaseConfig(process.env)).toEqual({
          driver: 'postgres',
          connectionString: pooledUrl,
        });
        expect(resolveMigrationDatabaseConfig(process.env)).toEqual({
          driver: 'postgres',
          connectionString: directUrl,
        });
      }
    );

    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: undefined,
        VERCEL: '1',
        VERCEL_ENV: 'production',
      },
      () => {
        expect(resolveMigrationDatabaseConfig(process.env)).toEqual({
          driver: 'postgres',
          connectionString: pooledUrl,
        });
      }
    );

    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: 'mysql://bad:secret_unpooled@host/db',
      },
      () => {
        let caught: Error | null = null;
        try {
          resolveMigrationDatabaseConfig(process.env);
        } catch (err) {
          caught = err as Error;
        }
        expect(caught).not.toBeNull();
        expect(caught!.message).toMatch(/DATABASE_URL_UNPOOLED/);
        expect(caught!.message).not.toContain('secret_unpooled');
      }
    );
  });

  it('manté PGlite per defecte i configurable en desenvolupament local', async () => {
    const cwd = path.resolve('c:/Feina/8-Rol');

    await withEnv(
      {
        NODE_ENV: 'development',
        DATABASE_URL: undefined,
        DATABASE_URL_UNPOOLED: undefined,
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      () => {
        expect(isProductionRuntime(process.env)).toBe(false);
        const cfg = resolveDatabaseConfig(process.env, cwd);
        expect(cfg.driver).toBe('pglite');
        if (cfg.driver === 'pglite') {
          expect(cfg.dataDir).toBe(path.resolve(cwd, './data/rol-dev'));
        }
      }
    );

    await withEnv(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'pglite://./data/rol-custom',
        DATABASE_URL_UNPOOLED: undefined,
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      () => {
        const cfg = resolveDatabaseConfig(process.env, cwd);
        expect(cfg.driver).toBe('pglite');
        if (cfg.driver === 'pglite') {
          expect(cfg.dataDir).toBe(path.resolve(cwd, './data/rol-custom'));
        }
      }
    );

    await withEnv(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/rol_local',
        DATABASE_URL_UNPOOLED: undefined,
        VERCEL: undefined,
        VERCEL_ENV: undefined,
      },
      () => {
        expect(resolveDatabaseConfig(process.env, cwd)).toEqual({
          driver: 'postgres',
          connectionString: 'postgresql://localhost:5432/rol_local',
        });
      }
    );
  });

  it('aplica migracions idempotentment amb bloqueig i avança des d’una BD amb només la migració 0000', async () => {
    const migrationsFolder = getMigrationsFolder();
    const migrations = readMigrationFiles({ migrationsFolder });
    expect(migrations.length).toBeGreaterThanOrEqual(2);

    // 1. BD que ja tenia la Fase 1 (només migració 0000 aplicada prèviament)
    const clientUpgrade = new PGlite();
    await clientUpgrade.waitReady;
    try {
      const db = drizzlePglite(clientUpgrade, { schema });
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
          "id" serial PRIMARY KEY NOT NULL,
          "hash" text NOT NULL,
          "created_at" bigint
        )
      `);
      for (const stmt of migrations[0].sql) {
        await db.execute(sql.raw(stmt));
      }
      await db.execute(sql`
        INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
        VALUES (${migrations[0].hash}, ${migrations[0].folderMillis})
      `);

      // Aplica únicament les migracions pendents (0001+)
      const upgradeRes = await applyLockedMigrationsAndSeed(db, migrationsFolder, {
        adminOptions: {
          email: 'admin.upgrade@rol.test',
          password: 'UpgradePassword123!',
          displayName: 'Admin Upgrade',
        },
      });
      expect(upgradeRes.appliedCount).toBe(migrations.length - 1);

      // Verifica que gm_notes ja existeix a characters
      const colCheck = await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'characters' AND column_name = 'gm_notes'
      `);
      expect(colCheck.rows).toHaveLength(1);

      // Segona execució: completament idempotent
      const secondRes = await applyLockedMigrationsAndSeed(db, migrationsFolder);
      expect(secondRes.appliedCount).toBe(0);

      const admins = await db.select().from(users).where(eq(users.role, 'admin'));
      expect(admins).toHaveLength(1);
    } finally {
      await clientUpgrade.close();
    }

    // 2. Execucions concurrents sobre BD buida protegides per pg_advisory_xact_lock
    const clientConcurrent = new PGlite();
    await clientConcurrent.waitReady;
    try {
      const db = drizzlePglite(clientConcurrent, { schema });
      const [resA, resB] = await Promise.all([
        applyLockedMigrationsAndSeed(db, migrationsFolder, {
          adminOptions: {
            email: 'admin.lock@rol.test',
            password: 'LockPassword123!',
          },
        }),
        applyLockedMigrationsAndSeed(db, migrationsFolder, {
          adminOptions: {
            email: 'admin.lock@rol.test',
            password: 'LockPassword123!',
          },
        }),
      ]);

      expect(resA.appliedCount + resB.appliedCount).toBe(migrations.length);
      const admins = await db.select().from(users).where(eq(users.role, 'admin'));
      expect(admins).toHaveLength(1);
    } finally {
      await clientConcurrent.close();
    }
  });
});
