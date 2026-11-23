import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { getMigrationsFolder, resolveMigrationDatabaseConfig } from './config';
import { applyLockedMigrationsAndSeed } from './migrate';
import * as schema from './schema';

export async function runCliMigration(): Promise<void> {
  const config = resolveMigrationDatabaseConfig(process.env);
  const migrationsFolder = getMigrationsFolder();

  if (config.driver === 'postgres') {
    const pool = new Pool({
      connectionString: config.connectionString,
      max: 1,
    });

    try {
      const db = drizzleNodePg(pool, { schema });
      const result = await applyLockedMigrationsAndSeed(db, migrationsFolder);
      console.log(
        `[db:migrate] PostgreSQL OK — ${result.appliedCount} migració(ns) aplicada(es) de ${result.totalMigrations}.`
      );
    } finally {
      await pool.end();
    }
    return;
  }

  fs.mkdirSync(config.dataDir, { recursive: true });
  const client = new PGlite(config.dataDir);
  try {
    await client.waitReady;
    const db = drizzlePglite(client, { schema });
    const result = await applyLockedMigrationsAndSeed(db, migrationsFolder);
    console.log(
      `[db:migrate] PGlite local OK — ${result.appliedCount} migració(ns) aplicada(es) de ${result.totalMigrations}.`
    );
  } finally {
    await client.close();
  }
}

runCliMigration().catch((error) => {
  console.error('[db:migrate] Error aplicant les migracions:', error);
  process.exit(1);
});
