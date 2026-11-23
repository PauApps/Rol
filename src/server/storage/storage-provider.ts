import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, type ReadStream } from 'node:fs';

export interface StoredFileMetadata {
  key: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * StorageProvider decouples document storage (manuals, maps in Phase 4+)
 * from Next.js or any single cloud vendor.
 * Files are never stored in `public/` and must only be streamed by authorized endpoints.
 */
export interface StorageProvider {
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFileMetadata>;
  getStream(key: string): Promise<ReadStream>;
  delete(key: string): Promise<void>;
}

function sanitizeStorageKey(rawKey: string): string {
  const normalized = rawKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((seg) => seg === '.' || seg === '..' || seg.includes('\0'))
  ) {
    throw new Error(`Invalid storage key: ${rawKey}`);
  }
  return segments.join('/');
}

export class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir = process.env.ROL_STORAGE_DIR ?? path.join(process.cwd(), 'data', 'uploads')) {
    this.rootDir = path.resolve(rootDir);
  }

  private resolveSafePath(key: string): { safeKey: string; fullPath: string } {
    const safeKey = sanitizeStorageKey(key);
    const fullPath = path.resolve(this.rootDir, safeKey);
    if (!fullPath.startsWith(this.rootDir + path.sep)) {
      throw new Error(`Path traversal rejected for key: ${key}`);
    }
    return { safeKey, fullPath };
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    contentType: string
  ): Promise<StoredFileMetadata> {
    const { safeKey, fullPath } = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return {
      key: safeKey,
      sizeBytes: data.byteLength,
      contentType,
    };
  }

  async getStream(key: string): Promise<ReadStream> {
    const { fullPath } = this.resolveSafePath(key);
    await fs.access(fullPath);
    return createReadStream(fullPath);
  }

  async delete(key: string): Promise<void> {
    const { fullPath } = this.resolveSafePath(key);
    await fs.rm(fullPath, { force: true });
  }
}

export function createStorageProvider(): StorageProvider {
  return new LocalDiskStorageProvider();
}
