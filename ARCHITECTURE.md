# Arquitectura del sistema

## Visió general per capes

L’arquitectura separa estrictament la presentació (UI, temes visuals, internacionalització i PWA), la capa de transport HTTP/REST, les polítiques d’autorització i la lògica de negoci, el domini pur de sistemes de rol i l’accés a dades.

```text
[UI Responsive + PWA + Temes CSS + i18n]   src/app/**, src/components/**, src/themes/**, src/i18n/**
                  │
                  ▼  HTTP + Cookies HttpOnly
[Capa API REST + Validació Zod]            src/app/api/**, src/server/http.ts
                  │
                  ▼
[Polítiques + Serveis de Negoci]          src/server/auth/**, src/server/services/**
[Domini Pur + Registre de Sistemes]       src/domain/**
                  │
                  ▼
[Base de Dades Relacional + Storage]       src/db/**, drizzle/**, src/server/storage/**
```

## Estructura de carpetes

- `src/domain/`: errors de negoci (`AppError`) i registre modular de sistemes de rol (`src/domain/systems/`). Inclou el model estructural inicial `dnd5e-2014` sense càlculs ni regles improvisades.
- `src/db/`: esquema Drizzle PostgreSQL (`schema.ts`), migracions aplicades automàticament, connexió dual (`PGlite` local / `pg.Pool` producció) i llavor inicial (`seed.ts`).
- `src/server/auth/`: primitives criptogràfiques (`scrypt`, `SHA-256`), resolució de sessions i polítiques d’autorització (`policies.ts`).
- `src/server/services/`: casos d’ús de negoci (`auth-service`, `admin-service`, `campaign-service`, `player-invitation-service`, `character-service`, `audit-service`).
- `src/server/storage/`: interfície `StorageProvider` i implementació local fora de `public/` (`LocalDiskStorageProvider`), preparada per connectar un proveïdor S3-compatible a la Fase 4.
- `src/themes/` i `src/i18n/`: sistema de temes basat en variables CSS semàntiques (`fantasy-classic.css`) i diccionaris tipats (`ca` inicial, preparat per a `es` i `en`).

## Decisions tècniques i justificació

1. **Autenticació pròpia amb sessions a BD en lloc de SaaS extern:**
   Permet gestionar de manera nativa invitacions tancades de GM, convidats sense compte, revocació instantània de sessions en bloquejar usuaris o membres, i independència total de proveïdor.
2. **PostgreSQL amb doble adaptador (`PGlite` / `pg`):**
   Evita dependre de Docker o d’un servidor extern en desenvolupament i proves unitàries/integració, mantenint el mateix dialecte PostgreSQL, restriccions `CHECK`, índexs parcials i `JSONB` que s’executaran en producció.
3. **Resolució de conflictes detectats al document mestre:**
   - **Nom de fitxer:** s’ha normalitzat `Document mestre.md` a `DOCUMENT_MESTRE.md` per coherència documental.
   - **Jugador ja registrat en obrir una invitació (§3.3 vs §5):** la pantalla d’invitació ofereix tres vies: entrar com a convidat, crear un compte nou o iniciar sessió amb un compte existent per sumar la nova campanya al perfil.
   - **Recuperació d’accés (§3.3 i §5):** els enllaços de recuperació només es generen per a membres convidats actius, queden lligats a un `target_member_id` únic i revoquen qualsevol sessió o enllaç de recuperació previ.
4. **Tematització desacoplada:**
   Cap component UI fa servir colors o tipografies rígides; tots consumeixen `--rol-*` definits a `[data-theme="fantasy-classic"]`.
5. **PWA amb connexió obligatòria:**
   El `manifest.ts` i `public/sw.js` permeten instal·lar la web com a app mantenint pass-through directe a xarxa perquè les dades multiusuari i permisos es validin sempre contra el servidor.
