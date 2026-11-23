# Model de dades

Totes les taules resideixen en **PostgreSQL** i es defineixen a [src/db/schema.ts](./src/db/schema.ts) amb migracions SQL versionades a [drizzle/](./drizzle).

## Taules principals (Fase 1)

| Taula | Funció principal | Claus i restriccions destacades |
|---|---|---|
| `users` | Comptes registrats (`admin`, `gm`, `player`) | `email` únic; `role` i `status` (`active`, `blocked`, `disabled`) validats per `CHECK`; `max_campaigns` opcional |
| `game_systems` | Catàleg de sistemes de rol | Clau textual (`dnd5e-2014` inicial) per admetre nous sistemes |
| `campaigns` | Campanyes creades per un GM | FK `gm_user_id -> users.id` (`RESTRICT`), `system_id -> game_systems.id`, `status` (`active`, `paused`, `finished`), `creation_config` JSONB (regles de creació), `max_characters_per_player` (límit per jugador), `virtual_dice_enabled` (`boolean`, activació del dau virtual pel GM, afegit a `0002_hard_firelord.sql`), paperera reversible (`deleted_at`, `purge_eligible_at`) |
| `campaign_members` | Participants d’una campanya (convidats o registrats) | `member_type` (`guest`, `registered`), `user_id` nul·lable, índex únic parcial `(campaign_id, user_id)` quan `user_id IS NOT NULL` |
| `sessions` | Sessions actives de comptes o convidats | Només desa `token_hash` (SHA-256); restricció `CHECK` XOR entre `user_id` i `campaign_member_id`; `revoked_at` i `expires_at` |
| `gm_invitations` | Invitacions tancades per registrar nous GM | Només desa `token_hash`, vinculada a `email`, d’un sol ús (`used_at`) i revocable (`revoked_at`) |
| `player_invitations` | Invitacions individuals i recuperació d’accés | **Sense `expires_at`** (no caduquen soles); `kind` (`join` o `recovery`); `CHECK` garanteix `target_member_id` obligatori només en `recovery` |
| `audit_logs` | Registre append-only d’operacions sensibles | Actor (`actor_user_id` / `actor_member_id`), `campaign_id`, `action`, `target_type`, `target_id`, `metadata` JSONB |

## Taules preparades i base de personatges (Fase 2–4)

| Taula | Estat | Propòsit |
|---|---|---|
| `characters` | Model universal `v2` ampliat (Fase 3, Increment 3B + revisió correctiva) | Emmagatzema personatges per campanya i membre, `schema_version` (`v1 → v2` retrocompatible), `sheet_data` JSONB validat amb Zod (incloent-hi `generalInfo.size`/`senses`, `savingThrows.rollModes`, `skills.rollModes`, `hitPoints.hitDiceUsedByDie` nul·lable per no inventar dades multiclasse antigues, `attacks.inventoryItemId`/`kind`/`spellSourceClassId`/`abilityOverride`/`proficientOverride`/`range`, categoria `magic_item`, sintonització, `weaponAbilityOverride` i camps d’arma a `inventory`, `attunement.limitOverride`, `spellcasting.sourceOverrides`, metadades/origen/preparació a `spells` i `progression.levelHistory`), `custom_fields`, `field_permissions` (`playerEditableFields`, `gmOnlyFields`, `authorizedOverrideFields`) i `gm_notes` (reservat exclusivament al GM, afegit a la migració `0001_cooing_hiroim.sql`) |
| `character_revisions` | Preparada (Fase 4) | Historial immutable de canvis per camp (`field_path`, `previous_value`, `new_value`, `reason`, `session_ref`) |

> **Nota sobre l’Increment 3B (sense migració SQL):** totes les ampliacions del model `Dnd5e2014SheetData` s’emmagatzemen dins la columna JSONB existent `characters.sheet_data` amb valors per defecte segurs a Zod i normalització automàtica a `normalizeDnd5e2014Sheet()` (preservant `hitDiceUsedByDie: null` en fitxes multiclasse antigues mixtes fins a una recuperació total). No cal executar cap nova migració DDL a PostgreSQL / Neon.

## Eliminació reversible (Paperera de 30 dies)

- En enviar una campanya a la paperera es desen `deleted_at = now()` i `purge_eligible_at = now() + 30 dies`.
- Mentre és a la paperera, queda oculta del llistat principal i totes les operacions de consulta/invitació per a jugadors queden bloquejades.
- El GM propietari pot recuperar-la dins dels 30 dies o eliminar-la definitivament escrivint exactament el nom de la campanya.

## Migracions en local vs producció (Vercel + Neon)

- **Local (`NODE_ENV !== 'production'`):** `getDb()` aplica les migracions de `drizzle/` automàticament amb `applyLockedMigrationsAndSeed()` (sobre PGlite o PostgreSQL local).
- **Producció (`NODE_ENV === 'production'` o `VERCEL === '1'`):** `DATABASE_URL` (`postgres://` / `postgresql://`) és obligatòria i qualsevol ús o fallback a PGlite queda bloquejat. Les migracions i la llavor inicial s’executen una sola vegada en temps de build mitjançant `npm run db:migrate` ([src/db/migrate.ts](./src/db/migrate.ts)) sota `pg_advisory_xact_lock`, compatible amb l’historial `__drizzle_migrations` i amb connexions directes (`DATABASE_URL_UNPOOLED`) o *pooler* de Neon.
