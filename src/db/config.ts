import path from 'node:path';

export type ResolvedDatabaseConfig =
  | {
      driver: 'postgres';
      connectionString: string;
    }
  | {
      driver: 'pglite';
      dataDir: string;
      url: string;
    };

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV === 'production' ||
    env.VERCEL === '1' ||
    env.VERCEL_ENV === 'production'
  );
}

export function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): ResolvedDatabaseConfig {
  const production = isProductionRuntime(env);
  const rawUrl = env.DATABASE_URL?.trim() ?? '';

  if (production) {
    if (!rawUrl) {
      throw new Error(
        'Falta la variable d’entorn obligatòria DATABASE_URL en producció (ha de ser una URL PostgreSQL).'
      );
    }

    if (rawUrl.startsWith('pglite://')) {
      throw new Error(
        'PGlite no està permès en producció. Configura DATABASE_URL amb una base de dades PostgreSQL (postgres:// o postgresql://).'
      );
    }

    if (!isPostgresUrl(rawUrl)) {
      throw new Error(
        'DATABASE_URL no és vàlida per a producció: només s’accepten connexions PostgreSQL (postgres:// o postgresql://).'
      );
    }

    return {
      driver: 'postgres',
      connectionString: rawUrl,
    };
  }

  const effectiveUrl = rawUrl || 'pglite://./data/rol-dev';

  if (isPostgresUrl(effectiveUrl)) {
    return {
      driver: 'postgres',
      connectionString: effectiveUrl,
    };
  }

  if (effectiveUrl.startsWith('pglite://')) {
    const rawDir = effectiveUrl.slice('pglite://'.length) || './data/rol-dev';
    const dataDir = path.isAbsolute(rawDir)
      ? rawDir
      : path.resolve(/*turbopackIgnore: true*/ cwd, rawDir);

    return {
      driver: 'pglite',
      dataDir,
      url: effectiveUrl,
    };
  }

  throw new Error(
    'Format de DATABASE_URL no suportat. Utilitza postgres://, postgresql:// o pglite://.'
  );
}

export function resolveMigrationDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): ResolvedDatabaseConfig {
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim() ?? '';
  if (unpooled) {
    if (!isPostgresUrl(unpooled)) {
      throw new Error(
        'DATABASE_URL_UNPOOLED no és vàlida: només s’accepten connexions PostgreSQL (postgres:// o postgresql://).'
      );
    }
    return {
      driver: 'postgres',
      connectionString: unpooled,
    };
  }

  return resolveDatabaseConfig(env, cwd);
}

export function getMigrationsFolder(cwd: string = process.cwd()): string {
  return path.join(/*turbopackIgnore: true*/ cwd, 'drizzle');
}
