# Rol

Plataforma web (PWA) en català per ajudar els Directors de Joc (**GM**) a organitzar i gestionar campanyes de rol presencials.

> **Document principal de requisits:** consulta [DOCUMENT_MESTRE.md](./DOCUMENT_MESTRE.md) per a la definició funcional completa del producte.

## Stack tecnològic (Fase 1)

- **Aplicació web i API:** Next.js (App Router) + React + TypeScript
- **Estils i temes:** Tailwind CSS v4 + CSS Custom Properties (`data-theme="fantasy-classic"`)
- **Base de dades:** PostgreSQL amb Drizzle ORM (`@electric-sql/pglite` en desenvolupament/proves; `pg` en producció)
- **Validació i proves:** Zod + Vitest

## Requisits previs

- **Node.js 22 LTS** o superior (verificat amb `v22.23.5`)
- **npm 10+** (en Windows PowerShell amb política restringida d’execució de scripts, utilitza `npm.cmd` i `npx.cmd`)

## Posada en marxa en local

1. Instal·la les dependències:

   ```bash
   npm.cmd install
   ```

2. Opcionalment, copia `.env.example` a `.env.local` i personalitza les credencials de l’administrador inicial:

   ```bash
   cp .env.example .env.local
   ```

   Per defecte, en entorn de desenvolupament s’utilitza:
   - **Base de dades local:** `pglite://./data/rol-dev` (no requereix Docker ni servidor PostgreSQL extern)
   - **Correu administrador inicial:** `admin@rol.local`
   - **Contrasenya administrador inicial:** `CanviaAquestaContrasenya123!`

3. Arrenca el servidor de desenvolupament:

   ```bash
   npm.cmd run dev
   ```

   Obre [http://localhost:3000](http://localhost:3000) al navegador.

## Scripts disponibles

| Script | Descripció |
|---|---|
| `npm.cmd run dev` | Inicia el servidor Next.js en mode desenvolupament |
| `npm.cmd run build` | Compila l’aplicació per a producció |
| `npm.cmd run start` | Executa la versió compilada |
| `npm.cmd run typecheck` | Comprova els tipus amb `tsc --noEmit` |
| `npm.cmd test` | Executa les proves d’integració i seguretat amb Vitest + PGlite |
| `npm.cmd run db:generate` | Genera migracions SQL a `drizzle/` des de `src/db/schema.ts` |
| `npm.cmd run db:seed` | Executa les migracions i la llavor inicial de sistemes i administrador |

## Documentació del projecte

- [DOCUMENT_MESTRE.md](./DOCUMENT_MESTRE.md): requisits i principis del producte
- [ARCHITECTURE.md](./ARCHITECTURE.md): arquitectura per capes i decisions tècniques
- [DATABASE.md](./DATABASE.md): esquema relacional, relacions i migracions
- [SECURITY.md](./SECURITY.md): model de permisos, tokens i aïllament entre campanyes
- [ROADMAP.md](./ROADMAP.md): fases d’implementació i estat actual
- [CHANGELOG.md](./CHANGELOG.md): registre de canvis
