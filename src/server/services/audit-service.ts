import { auditLogs } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

export interface AuditEntryInput {
  actorUserId?: string | null;
  actorMemberId?: string | null;
  campaignId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit log helper.
 * Callers must NEVER include raw invitation tokens, session tokens, or passwords in metadata.
 */
export async function recordAuditLog(db: AppDatabase, entry: AuditEntryInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    actorMemberId: entry.actorMemberId ?? null,
    campaignId: entry.campaignId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
  });
}
