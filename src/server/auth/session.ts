import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import {
  campaignMembers,
  campaigns,
  sessions,
  users,
  type MemberStatus,
  type UserRole,
  type UserStatus,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { generateSecureToken, hashToken } from './crypto';

export const SESSION_COOKIE_NAME = 'rol_session';
export const SESSION_TTL_DAYS = 30;

export interface UserAuthContext {
  kind: 'user';
  sessionId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    maxCampaigns: number | null;
    preferredLocale: string;
  };
}

export interface GuestAuthContext {
  kind: 'guest';
  sessionId: string;
  member: {
    id: string;
    campaignId: string;
    displayName: string;
    memberType: 'guest';
    status: MemberStatus;
  };
}

export type AuthContext = UserAuthContext | GuestAuthContext;

function buildExpiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
}

export async function createSessionForUser(
  db: AppDatabase,
  userId: string
): Promise<{ sessionId: string; rawToken: string; expiresAt: Date }> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = buildExpiryDate();

  const [created] = await db
    .insert(sessions)
    .values({
      tokenHash,
      userId,
      campaignMemberId: null,
      expiresAt,
    })
    .returning({ id: sessions.id });

  return { sessionId: created.id, rawToken, expiresAt };
}

export async function createSessionForMember(
  db: AppDatabase,
  memberId: string
): Promise<{ sessionId: string; rawToken: string; expiresAt: Date }> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = buildExpiryDate();

  const [created] = await db
    .insert(sessions)
    .values({
      tokenHash,
      userId: null,
      campaignMemberId: memberId,
      expiresAt,
    })
    .returning({ id: sessions.id });

  return { sessionId: created.id, rawToken, expiresAt };
}

export async function resolveSession(
  db: AppDatabase,
  rawToken: string | null | undefined
): Promise<AuthContext | null> {
  if (!rawToken || rawToken.trim().length < 16) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [sessionRow] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      campaignMemberId: sessions.campaignMemberId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!sessionRow) {
    return null;
  }

  if (sessionRow.userId) {
    const [userRow] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        maxCampaigns: users.maxCampaigns,
        preferredLocale: users.preferredLocale,
      })
      .from(users)
      .where(eq(users.id, sessionRow.userId))
      .limit(1);

    if (!userRow || userRow.status !== 'active') {
      return null;
    }

    return {
      kind: 'user',
      sessionId: sessionRow.id,
      user: userRow,
    };
  }

  if (sessionRow.campaignMemberId) {
    const [memberRow] = await db
      .select({
        id: campaignMembers.id,
        campaignId: campaignMembers.campaignId,
        displayName: campaignMembers.displayName,
        memberType: campaignMembers.memberType,
        status: campaignMembers.status,
        campaignDeletedAt: campaigns.deletedAt,
      })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaignMembers.campaignId, campaigns.id))
      .where(eq(campaignMembers.id, sessionRow.campaignMemberId))
      .limit(1);

    if (
      !memberRow ||
      memberRow.status !== 'active' ||
      memberRow.memberType !== 'guest' ||
      memberRow.campaignDeletedAt !== null
    ) {
      return null;
    }

    return {
      kind: 'guest',
      sessionId: sessionRow.id,
      member: {
        id: memberRow.id,
        campaignId: memberRow.campaignId,
        displayName: memberRow.displayName,
        memberType: 'guest',
        status: memberRow.status,
      },
    };
  }

  return null;
}

export async function revokeSessionById(db: AppDatabase, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeSessionByRawToken(db: AppDatabase, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

export async function revokeAllSessionsForUser(db: AppDatabase, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function revokeAllSessionsForMember(db: AppDatabase, memberId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.campaignMemberId, memberId), isNull(sessions.revokedAt)));
}

export async function getServerAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }
  const db = await getDb();
  return resolveSession(db, rawToken);
}
