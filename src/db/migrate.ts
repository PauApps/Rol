import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { seedGameSystems, seedInitialAdmin } from './seed';
import type { AppDatabase } from './types';

/**
 * Deterministic 32-bit advisory lock key for Rol PostgreSQL schema migrations + initial seed.
 * Uses transaction-scoped advisory locking (`pg_advisory_xact_lock`), which is safe with both
 * direct PostgreSQL connections and Neon PgBouncer transaction poolers.
 */
export const MIGRATION_ADVISORY_LOCK_KEY = 784215931;

export interface ApplyMigrationsOptions {
  seedAdmin?: boolean;
  adminOptions?: {
    email?: string;
    password?: string;
    displayName?: string;
  };
}

export interface ApplyMigrationsResult {
  appliedCount: number;
  totalMigrations: number;
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as Array<Record<string, unknown>>;
  }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as Array<Record<string, unknown>>;
    }
  }
  return [];
}

/**
 * Applies pending SQL migrations from `drizzle/` and runs idempotent base seed inside a single
 * PostgreSQL advisory-locked transaction (`pg_advisory_xact_lock`).
 *
 * Compatible with Drizzle's `"drizzle"."__drizzle_migrations"` history table so databases already
 * initialized by Drizzle's built-in migrator advance seamlessly without re-running old files.
 */
export async function applyLockedMigrationsAndSeed(
  db: AppDatabase,
  migrationsFolder: string,
  options?: ApplyMigrationsOptions
): Promise<ApplyMigrationsResult> {
  const migrations = readMigrationFiles({ migrationsFolder });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_ADVISORY_LOCK_KEY})`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        "id" serial PRIMARY KEY NOT NULL,
        "hash" text NOT NULL,
        "created_at" bigint
      )
    `);

    const lastResult = await tx.execute(sql`
      SELECT "id", "hash", "created_at"
      FROM "drizzle"."__drizzle_migrations"
      ORDER BY "created_at" DESC
      LIMIT 1
    `);

    const rows = extractRows(lastResult);
    const lastCreatedAt =
      rows.length > 0 && rows[0].created_at !== null && rows[0].created_at !== undefined
        ? Number(rows[0].created_at)
        : null;

    let appliedCount = 0;

    for (const migration of migrations) {
      if (lastCreatedAt === null || lastCreatedAt < migration.folderMillis) {
        for (const stmt of migration.sql) {
          await tx.execute(sql.raw(stmt));
        }
        await tx.execute(sql`
          INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
          VALUES (${migration.hash}, ${migration.folderMillis})
        `);
        appliedCount += 1;
      }
    }

    await seedGameSystems(tx);
    if (options?.seedAdmin !== false) {
      await seedInitialAdmin(tx, options?.adminOptions);
    }

    return {
      appliedCount,
      totalMigrations: migrations.length,
    };
  });
}
