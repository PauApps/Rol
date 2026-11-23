import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';
import { ensureBaseSeed, seedGameSystems } from './seed';
import type { AppDatabase } from './types';

interface GlobalDbState {
  initPromise?: Promise<AppDatabase>;
  db?: AppDatabase;
  pgliteClient?: PGlite;
  pgPool?: Pool;
}

const globalForDb = globalThis as unknown as {
  __rolDbState?: GlobalDbState;
};

if (!globalForDb.__rolDbState) {
  globalForDb.__rolDbState = {};
}

function getMigrationsFolder(): string {
  return path.join(process.cwd(), 'drizzle');
}

async function initializeAppDb(): Promise<AppDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || 'pglite://./data/rol-dev';
  const migrationsFolder = getMigrationsFolder();
  const state = globalForDb.__rolDbState!;

  if (databaseUrl.startsWith('pglite://')) {
    const rawDir = databaseUrl.slice('pglite://'.length) || './data/rol-dev';
    const dataDir = path.isAbsolute(rawDir) ? rawDir : path.resolve(process.cwd(), rawDir);
    fs.mkdirSync(dataDir, { recursive: true });

    const client = new PGlite(dataDir);
    await client.waitReady;
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder });
    await ensureBaseSeed(db);

    state.pgliteClient = client;
    state.db = db;
    return db;
  }

  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzleNodePg(pool, { schema });
    await migrateNodePg(db, { migrationsFolder });
    await ensureBaseSeed(db);

    state.pgPool = pool;
    state.db = db;
    return db;
  }

  throw new Error(
    `Format de DATABASE_URL no suportat: "${databaseUrl}". Utilitza pglite:// o postgresql://`
  );
}

export async function getDb(): Promise<AppDatabase> {
  const state = globalForDb.__rolDbState!;
  if (state.db) {
    return state.db;
  }
  if (!state.initPromise) {
    state.initPromise = initializeAppDb().catch((err) => {
      state.initPromise = undefined;
      throw err;
    });
  }
  return state.initPromise;
}

export async function closeAppDb(): Promise<void> {
  const state = globalForDb.__rolDbState;
  if (!state) return;
  if (state.pgliteClient) {
    await state.pgliteClient.close();
  }
  if (state.pgPool) {
    await state.pgPool.end();
  }
  state.db = undefined;
  state.initPromise = undefined;
  state.pgliteClient = undefined;
  state.pgPool = undefined;
}

export interface TestDbHandle {
  db: AppDatabase;
  close: () => Promise<void>;
}

/**
 * Creates a clean, isolated in-memory PostgreSQL (PGlite) database for automated tests.
 */
export async function createTestDb(): Promise<TestDbHandle> {
  const client = new PGlite();
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: getMigrationsFolder() });
  await seedGameSystems(db);

  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}
