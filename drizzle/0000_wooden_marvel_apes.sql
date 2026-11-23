CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_member_id" uuid,
	"campaign_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"member_type" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_members_type_check" CHECK ("campaign_members"."member_type" IN ('guest', 'registered')),
	CONSTRAINT "campaign_members_status_check" CHECK ("campaign_members"."status" IN ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gm_user_id" uuid NOT NULL,
	"system_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"creation_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_characters_per_player" integer,
	"deleted_at" timestamp with time zone,
	"purge_eligible_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_status_check" CHECK ("campaigns"."status" IN ('active', 'paused', 'finished'))
);
--> statement-breakpoint
CREATE TABLE "character_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"changed_by_user_id" uuid,
	"changed_by_member_id" uuid,
	"field_path" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"session_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"member_id" uuid,
	"system_id" text NOT NULL,
	"name" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"sheet_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"version" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gm_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gm_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "player_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" text DEFAULT 'join' NOT NULL,
	"target_member_id" uuid,
	"token_hash" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_member_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "player_invitations_kind_check" CHECK ("player_invitations"."kind" IN ('join', 'recovery')),
	CONSTRAINT "player_invitations_target_check" CHECK (("player_invitations"."kind" = 'join' AND "player_invitations"."target_member_id" IS NULL) OR ("player_invitations"."kind" = 'recovery' AND "player_invitations"."target_member_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid,
	"campaign_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_actor_xor_check" CHECK (("sessions"."user_id" IS NOT NULL AND "sessions"."campaign_member_id" IS NULL) OR ("sessions"."user_id" IS NULL AND "sessions"."campaign_member_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"max_campaigns" integer,
	"preferred_locale" text DEFAULT 'ca' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('admin', 'gm', 'player')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('active', 'blocked', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_member_id_campaign_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."campaign_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_gm_user_id_users_id_fk" FOREIGN KEY ("gm_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_system_id_game_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_revisions" ADD CONSTRAINT "character_revisions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_revisions" ADD CONSTRAINT "character_revisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_revisions" ADD CONSTRAINT "character_revisions_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_revisions" ADD CONSTRAINT "character_revisions_changed_by_member_id_campaign_members_id_fk" FOREIGN KEY ("changed_by_member_id") REFERENCES "public"."campaign_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_member_id_campaign_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."campaign_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_system_id_game_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_invitations" ADD CONSTRAINT "gm_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gm_invitations" ADD CONSTRAINT "gm_invitations_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_target_member_id_campaign_members_id_fk" FOREIGN KEY ("target_member_id") REFERENCES "public"."campaign_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_invitations" ADD CONSTRAINT "player_invitations_used_by_member_id_campaign_members_id_fk" FOREIGN KEY ("used_by_member_id") REFERENCES "public"."campaign_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_member_id_campaign_members_id_fk" FOREIGN KEY ("campaign_member_id") REFERENCES "public"."campaign_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_campaign_created_idx" ON "audit_logs" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_members_campaign_user_unique" ON "campaign_members" USING btree ("campaign_id","user_id") WHERE "campaign_members"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "campaign_members_campaign_status_idx" ON "campaign_members" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "campaigns_gm_deleted_idx" ON "campaigns" USING btree ("gm_user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "character_revisions_char_created_idx" ON "character_revisions" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE INDEX "characters_campaign_member_idx" ON "characters" USING btree ("campaign_id","member_id");--> statement-breakpoint
CREATE INDEX "player_invitations_campaign_created_idx" ON "player_invitations" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_member_idx" ON "sessions" USING btree ("campaign_member_id");