import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export type UserRole = 'admin' | 'gm' | 'player';
export type UserStatus = 'active' | 'blocked' | 'disabled';
export type CampaignStatus = 'active' | 'paused' | 'finished';
export type MemberType = 'guest' | 'registered';
export type MemberStatus = 'active' | 'revoked';
export type PlayerInvitationKind = 'join' | 'recovery';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').$type<UserRole>().notNull(),
    status: text('status').$type<UserStatus>().notNull().default('active'),
    maxCampaigns: integer('max_campaigns'),
    preferredLocale: text('preferred_locale').notNull().default('ca'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('users_role_check', sql`${table.role} IN ('admin', 'gm', 'player')`),
    check('users_status_check', sql`${table.status} IN ('active', 'blocked', 'disabled')`),
  ]
);

export const gameSystems = pgTable('game_systems', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  version: text('version').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gmUserId: uuid('gm_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    systemId: text('system_id')
      .notNull()
      .references(() => gameSystems.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<CampaignStatus>().notNull().default('active'),
    creationConfig: jsonb('creation_config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    maxCharactersPerPlayer: integer('max_characters_per_player'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    purgeEligibleAt: timestamp('purge_eligible_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('campaigns_gm_deleted_idx').on(table.gmUserId, table.deletedAt),
    check('campaigns_status_check', sql`${table.status} IN ('active', 'paused', 'finished')`),
  ]
);

export const campaignMembers = pgTable(
  'campaign_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    memberType: text('member_type').$type<MemberType>().notNull(),
    displayName: text('display_name').notNull(),
    status: text('status').$type<MemberStatus>().notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('campaign_members_campaign_user_unique')
      .on(table.campaignId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    index('campaign_members_campaign_status_idx').on(table.campaignId, table.status),
    check('campaign_members_type_check', sql`${table.memberType} IN ('guest', 'registered')`),
    check('campaign_members_status_check', sql`${table.status} IN ('active', 'revoked')`),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    campaignMemberId: uuid('campaign_member_id').references(() => campaignMembers.id, {
      onDelete: 'cascade',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_member_idx').on(table.campaignMemberId),
    check(
      'sessions_actor_xor_check',
      sql`(${table.userId} IS NOT NULL AND ${table.campaignMemberId} IS NULL) OR (${table.userId} IS NULL AND ${table.campaignMemberId} IS NOT NULL)`
    ),
  ]
);

export const gmInvitations = pgTable('gm_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  note: text('note').notNull().default(''),
  invitedByUserId: uuid('invited_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  usedByUserId: uuid('used_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playerInvitations = pgTable(
  'player_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<PlayerInvitationKind>().notNull().default('join'),
    targetMemberId: uuid('target_member_id').references(() => campaignMembers.id, {
      onDelete: 'cascade',
    }),
    tokenHash: text('token_hash').notNull().unique(),
    label: text('label').notNull().default(''),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByMemberId: uuid('used_by_member_id').references(() => campaignMembers.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('player_invitations_campaign_created_idx').on(table.campaignId, table.createdAt),
    check('player_invitations_kind_check', sql`${table.kind} IN ('join', 'recovery')`),
    check(
      'player_invitations_target_check',
      sql`(${table.kind} = 'join' AND ${table.targetMemberId} IS NULL) OR (${table.kind} = 'recovery' AND ${table.targetMemberId} IS NOT NULL)`
    ),
  ]
);

export const characters = pgTable(
  'characters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => campaignMembers.id, {
      onDelete: 'set null',
    }),
    systemId: text('system_id')
      .notNull()
      .references(() => gameSystems.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    sheetData: jsonb('sheet_data').$type<Record<string, unknown>>().notNull().default({}),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
    fieldPermissions: jsonb('field_permissions')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    gmNotes: text('gm_notes').notNull().default(''),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('characters_campaign_member_idx').on(table.campaignId, table.memberId)]
);

export const characterRevisions = pgTable(
  'character_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    changedByMemberId: uuid('changed_by_member_id').references(() => campaignMembers.id, {
      onDelete: 'set null',
    }),
    fieldPath: text('field_path').notNull(),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    reason: text('reason'),
    sessionRef: text('session_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('character_revisions_char_created_idx').on(table.characterId, table.createdAt)]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorMemberId: uuid('actor_member_id').references(() => campaignMembers.id, {
      onDelete: 'set null',
    }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_campaign_created_idx').on(table.campaignId, table.createdAt),
    index('audit_logs_created_idx').on(table.createdAt),
  ]
);
