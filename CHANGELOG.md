# Registre de canvis (Changelog)

## [0.3.0-dev] — Fase 3, Increments 1 i 2 (Motor D&D 5e 2014, validació Zod v2, persistència i permisos granulars)

### Afegit i actualitzat (Increment 2 + revisió Increment 1)
- **Validació Zod completa v2 (`src/domain/systems/dnd5e-2014/validation.ts`):** esquemes estrictes `.strict()` (`dnd5e2014SheetSchema`, `dnd5e2014SheetPatchSchema`, `createCharacterRequestSchema`, `updateCharacterRequestSchema`) amb fusió segura (`mergeDnd5e2014SheetPatch`) i rebuig de camps desconeguts, valors derivats falsificats o nivells superiors a 20.
- **Protecció de càlculs oficials i permisos granulars (`src/domain/systems/dnd5e-2014/permissions.ts`):** bloqueig al servidor d’overrides oficials (`savingThrows.overrides`, `skills.overrides`, `armorClass.override`, `initiative.*`, `attacks.bonusOverride`, `attacks.attackBonus`, `spellcasting.*Override`, `spellSlotOverrides`, `customResources`) llevat d’autorització explícita del GM (`fieldPermissions.authorizedOverrideFields`).
- **Validador de creació de campanya (`src/domain/systems/dnd5e-2014/creation-validator.ts`):** aplicació al servidor de `freedomMode` (`free`, `guided`, `strict`), `startingLevel`, llistes permeses (amb resolució d’àlies catalans) i `requiredFields`, preservant les excepcions del GM.
- **Servei i endpoints de personatges (`character-service.ts`, `/api/campaigns/[id]/characters`, `/api/campaigns/[id]/characters/[characterId]`):** normalització transparent de fitxes `v1 → v2` sense pèrdua de dades, càlcul en viu de `computed` respectant `gmOnlyFields`, i actualització a `schemaVersion: 2`.
- **Ajustos d’Increment 1:** acotament oficial estrictament fins a nivell 20 a `catalog.ts` i `rules.ts` (`MAX_OFFICIAL_LEVEL_2014 = 20`, sense extrapolació) i distinció a `rollD20Check()` (`dice.ts`) entre `isNatural20`/`isNatural1` i `isCriticalHit`/`isCriticalMiss` exclusius d’atacs (`checkType === 'attack'`).
- **Noves proves:** ampliació de `tests/dnd5e-2014-rules-engine.test.ts` i `tests/phase2-campaign-rules-and-limits.test.ts`, més nova suite `tests/phase3-character-persistence-and-permissions.test.ts` (fitxes v2, compatibilitat v1, Zod, permisos granulars, restriccions de campanya, persistència entre sessions i integritat de migracions `0000 -> 0001 -> 0002`).

### Afegit (Increment 1)
- **Configuració del dau virtual controlada pel GM:** nova columna `campaigns.virtual_dice_enabled` (`drizzle/0002_hard_firelord.sql`, per defecte `false`), exposada a `getCampaignDetail`, editable únicament pel GM propietari via `PATCH /api/campaigns/[id]/creation-config` i integrada al panell de campanya.
- **Model universal D&D 5e (2014) (`schemaVersion: 2`):** catàleg base de les 12 classes, 18 habilitats, 6 característiques, taula XP 1–20 i espais de conjur (`catalog.ts`), més normalització retrocompatible `v1 → v2` (`normalizeDnd5e2014Sheet`) sense dades específiques de Pim per defecte.
- **Motor pur de regles D&D 5e (2014):**
  - `rules.ts`: modificadors, bonificació de competència oficial (1–20, màxim +6), 6 salvacions, 18 habilitats amb competència/mitja competència/expertesa/excepcions, percepció/investigació/perspicàcia passives, classe d’armadura (armadures, escut, Bàrbar, Monjo, override), màgia (CD, atac, espais complets/mitjans/terços/pacte i grimori) i progressió oficial fins a nivell 20.
  - `resources.ts`: recursos modulars segons classe, subclasse i nivell (Ira, Inspiració bàrdica, Canalitzar divinitat, Forma salvatge / Forma estel·lar / Mapa estel·lar, Segon alè / Acció sobtada / Indomable / Daus de superioritat, Punts de Ki, Imposició de mans / Sentit diví, Cop de sort, Punts de bruixeria, Arcanum místic, Recuperació arcana i recursos personalitzats).
  - `dice.ts`: lògica de tirades `d20` amb avantatge, desavantatge i cancel·lació mútua estricta segons D&D 5e 2014.
- Noves proves a `tests/dnd5e-2014-rules-engine.test.ts` i `tests/dnd5e-2014-virtual-dice-config.test.ts`.

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
