# Registre de canvis (Changelog)

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
