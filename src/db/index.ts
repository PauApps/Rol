import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import {
  getMigrationsFolder,
  isProductionRuntime,
  resolveDatabaseConfig,
  resolveMigrationDatabaseConfig,
  type ResolvedDatabaseConfig,
} from './config';
import { applyLockedMigrationsAndSeed } from './migrate';
import * as schema from './schema';
import { seedGameSystems } from './seed';
import type { AppDatabase } from './types';

export {
  isProductionRuntime,
  resolveDatabaseConfig,
  resolveMigrationDatabaseConfig,
  type ResolvedDatabaseConfig,
};

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

async function initializeAppDb(): Promise<AppDatabase> {
  const config = resolveDatabaseConfig(process.env);
  const state = globalForDb.__rolDbState!;

  if (config.driver === 'pglite') {
    if (isProductionRuntime(process.env)) {
      throw new Error('PGlite no es pot inicialitzar en un entorn de producció.');
    }

    fs.mkdirSync(config.dataDir, { recursive: true });

    const client = new PGlite(config.dataDir);
    await client.waitReady;
    const db = drizzlePglite(client, { schema });
    await applyLockedMigrationsAndSeed(db, getMigrationsFolder());

    state.pgliteClient = client;
    state.db = db;
    return db;
  }

  const production = isProductionRuntime(process.env);
  const pool = new Pool({
    connectionString: config.connectionString,
    max: production ? 5 : 10,
  });
  const db = drizzleNodePg(pool, { schema });

  // En producció (Vercel + Neon) les migracions i la llavor inicial s'executen una sola vegada
  // en temps de build (`npm run db:migrate`), evitant DDL concurrent i lectura de `drizzle/` en runtime.
  if (!production) {
    await applyLockedMigrationsAndSeed(db, getMigrationsFolder());
  }

  state.pgPool = pool;
  state.db = db;
  return db;
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
