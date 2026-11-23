# Registre de canvis (Changelog)

## [0.2.0] — Auditoria Fase 1 i Fase 2

### Corregit (Auditoria de Fase 1)
- **Visibilitat de personatges:** els jugadors i convidats ara poden consultar totes les fitxes base de la seva pròpia campanya, mantenint ocults `gm_notes`, `field_permissions` i els camins marcats a `gmOnlyFields` (`stripGmOnlyFields`).
- **Edició controlada de fitxes:** afegit endpoint `GET/PATCH /api/campaigns/[id]/characters/[characterId]` amb validació al servidor que restringeix els jugadors al seu propi personatge i als camps autoritzats pel GM.
- **Activitat privada i multi-rol:** filtrat d’accions sensibles del GM a l’activitat visible per a jugadors a `getCampaignDetail`, exclusió de comptes `admin` a invitacions de jugador i inclusió a `listCampaignsForActor` de les campanyes on un GM participa com a jugador.
- Eliminat l’avís de traça dinàmica de Turbopack a `src/db/index.ts`.

### Afegit (Fase 2)
- **Configuració de creació de personatges:** model, validació Zod i UI editable (`PATCH /api/campaigns/[id]/creation-config`) per a nivell inicial, grau de llibertat, mètode de característiques, races/classes/antecedents permesos, camps obligatoris i restriccions.
- **Límit de personatges per jugador:** validat al servidor dins de transacció en crear personatges i en fusionar identitats (`CHARACTER_LIMIT_REACHED`, `CHARACTER_LIMIT_EXCEEDED_ON_MERGE`).
- **Vinculació d’identitat per a convidats:** servei transaccional (`identity-linking-service.ts`), endpoint `POST /api/auth/link-account` i modal a la UI per crear un compte nou o vincular-se a un compte existent amb verificació de contrasenya, consolidant personatges sense duplicats i revocant les sessions prèvies de convidat.
- Migració additiva `drizzle/0001_cooing_hiroim.sql` (`characters.gm_notes`).
- **Protecció i migracions per a Vercel + Neon:**
  - Validació estricta a `src/db/config.ts` i `src/db/index.ts` perquè producció (`NODE_ENV=production` o `VERCEL=1`) exigeixi `DATABASE_URL` (`postgres://`/`postgresql://`) sense fallback a PGlite.
  - Nou script `npm run db:migrate` (`src/db/migrate.ts` + `src/db/migrate-cli.ts`) amb `pg_advisory_xact_lock` i configuració a `vercel.json` (`npm run db:migrate && npm run build`), eliminant la lectura de `drizzle/` i el DDL concurrent en runtime serverless.
  - Suport opcional de `DATABASE_URL_UNPOOLED` per a migracions en temps de build sobre Neon.
  - Enduriment de `.gitignore` per excloure tots els fitxers `.env.*` excepte `.env.example`.
- Noves proves automatitzades per a permisos de fitxa, regles de creació, límits, vinculació d’identitats, bloqueig de PGlite en producció i migracions concurrents.

## [0.1.0] — Fase 1 (Base del MVP)

### Afegit
- Inicialització del projecte **Rol** amb Next.js App Router, TypeScript, Tailwind CSS v4, Drizzle ORM i PostgreSQL (PGlite local i en proves).
- Esquema relacional complet (`users`, `sessions`, `gm_invitations`, `game_systems`, `campaigns`, `campaign_members`, `player_invitations`, `characters`, `character_revisions`, `audit_logs`) amb migració inicial a `drizzle/`.
- Sistema d’autenticació amb sessions persistides (cookies `HttpOnly`, hashes `SHA-256` per a tokens i `scrypt` per a contrasenyes) i registre tancat de GM per invitació.
- Panell d’administració principal per convidar/revocar GMs, bloquejar/desactivar/reactivar comptes i consultar l’auditoria.
- Gestió de campanyes del GM (`D&D 5e 2014`), estats (`activa`, `pausada`, `finalitzada`), paperera reversible de 30 dies i purga amb confirmació explícita.
- Sistema d’invitacions individuals per a jugadors sense caducitat automàtica (accés com a convidat amb àlies, registre de compte nou o compte existent), revocació i enllaços de recuperació segura vinculats a un membre concret.
- Interfície responsive en català amb tema `fantasy-classic`, menú lateral plegable i configuració PWA (`manifest.ts` + `sw.js`).
- Model base estructural de personatges D&D 5e (2014) i abstracció `StorageProvider`.
- Suite de proves d’integració i seguretat amb Vitest (`tests/`).
