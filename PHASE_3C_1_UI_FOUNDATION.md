# Informe de implementació — Fase 3, Increment 3C.1 (Pantalla universal de personatge i primera pestanya)

**Repositori:** `https://github.com/PauApps/Rol`  
**Branca base:** `main` (sobre `7cc5f736c7c0644eb13be25890bafc371c854fa6`)  
**Data:** 2026-11-25

---

## 1. Confirmació explícita d'abast i restriccions

- **Domini intacte:** No s'ha modificat cap fitxer dins `src/domain/systems/dnd5e-2014/**` (`schema.ts`, `catalog.ts`, `rules.ts`, `attacks.ts`, `dice.ts`, `rests.ts`, `validation.ts`, `permissions.ts`). Tota la lògica oficial continua executant-se exclusivament al servidor.
- **Serveis i API intactes:** No s'ha modificat `src/server/services/character-service.ts` ni cap ruta dins `src/app/api/**`.
- **Base de dades i migracions intactes:** No s'ha modificat `src/db/**` ni `drizzle/**`.
- **Control d'increment:** No s'ha implementat el contingut de les pestanyes 2–5, no s'ha iniciat l'Increment 3C.2 i no s'ha fet cap `git commit` ni `git push`.

---

## 2. Auditoria prèvia verificada

Abans d'implementar la interfície s'han auditat els contractes reals existents:

1. **Càrrega i dades calculades:** `getCampaignCharacter(db, ctx, campaignId, characterId)` normalitza tant fitxes `v1` com `v2`, oculta camps `gmOnlyFields` i notes del GM per als jugadors, i calcula `computed = computeDnd5e2014Sheet(...)` sobre dades segures.
2. **Contracte de PATCH:** `/api/campaigns/[id]/characters/[characterId]` (`PATCH`) valida contra `updateCharacterRequestSchema` i accepta `name`, `sheetFields`, `sheetPatch`, `customFields`, `gmNotes`, `fieldPermissions` i `memberId`, fent fusió profunda (`mergeDnd5e2014SheetPatch`) perquè un patch parcial no sobreescrigui la resta de la fitxa.
3. **Permisos al client:** el servidor exposa `isMine`, `canEdit`, `editableFields` (`['*']` per al GM), `authorizedOverrideFields` i, només per al GM, `gmNotes` i `fieldPermissions`.
4. **Camps protegits:** tots els camins de `PROTECTED_OFFICIAL_CALCULATION_PATHS` (inclosos `savingThrows.overrides`, `skills.overrides`, `armorClass.override`, `initiative.override`, `initiative.bonus`, `attacks.ability`, `attacks.proficient`, `attacks.gmCustom`, `attacks.bonusOverride`, `attacks.attackBonus`) estan bloquejats als jugadors (`403 OFFICIAL_CALCULATION_PROTECTED`) llevat que figurin a `authorizedOverrideFields`.
5. **Dau virtual i descansos:** existeixen les funcions pures `dice.ts` i `rests.ts` al domini, però **encara no existeixen endpoints HTTP dedicats** per executar tirades virtuals o descansos; s'ha deixat documentada la integració per al 3C.4 sense inventar endpoints ni simular tirades.

---

## 3. Arquitectura de components creada i ruta nova

### Ruta nova i integració amb la campanya
- **Ruta:** [`src/app/campaigns/[id]/characters/[characterId]/page.tsx`](src/app/campaigns/[id]/characters/[characterId]/page.tsx) (`dynamic = 'force-dynamic'`).
  - Valida sessió autenticada (redirecció a `/login`), UUIDs (`assertUuid`), pertinença a la campanya (`getCampaignDetail`) i accés al personatge (`getCampaignCharacter`).
  - Serialitza el personatge dins `<AppShell>` passant només dades privades de GM (`gmNotes`, `fieldPermissions`) quan `detail.canManage === true`.
- **Integració a campanya:** [`src/components/campaigns/CampaignDetailClient.tsx`](src/components/campaigns/CampaignDetailClient.tsx) enllaça cada personatge (nom i botó principal `Obrir fitxa` / `Consultar fitxa`) cap a `/campaigns/[id]/characters/[characterId]`, conservant un botó secundari (`Gestió GM` / `Edició ràpida`) al modal existent perquè no es perdi cap funcionalitat de notes de GM, permisos o aspecte/història fins al 3C.3.

### Components de la fitxa universal
- **Contenidor i estat (`src/components/characters/CharacterSheetClient.tsx`):**
  - Manté l'estat sincronitzat (`character`), l'esborrany editable (`draft`), la pestanya activa (`combat` per defecte), barra explícita de desament/descart (`Desar canvis` / `Descartar`) i bloqueig `inFlightRef` per impedir curses de PATCH concurrents.
  - En canviar de pestanya, no perd els canvis pendents. En desar amb èxit, substitueix l'estat amb la resposta recalcular del servidor.
- **Helpers pures de UI (sense càlculs de regles):**
  - `src/components/characters/types.ts`: definició de les 5 pestanyes, tipus DTO (`CharacterSheetRecord`, `CharacterCampaignContext`, `CharacterSheetDraft`) i formatadors de visualització (`formatSigned`, `formatClassesSummary`, `formatRaceSummary`, `formatSpeedSummary`).
  - `src/components/characters/sheet-permissions.ts`: mirall visual `canEditSheetField` sobre `editableFields` i `authorizedOverrideFields` sense confiar-hi com a barrera de seguretat.
  - `src/components/characters/sheet-patch.ts`: `createDraftFromCharacter` i `buildCharacterSheetPatch` que construeixen exclusivament un diff mínim autoritzat, protegeixen atacs `gm_custom`/`weapon_override` i no inventen mai `hitDiceUsedByDie` quan és `null`.
- **Capçalera, pestanyes i modal GM:**
  - `src/components/characters/CharacterHeader.tsx`: capçalera persistent responsive (`rol-sheet-banner`) amb els 10 indicadors requerits des de `computed` i `sheetData`, edició en línia del nom (si està autoritzada), insígnia informativa passiva si `virtualDiceEnabled === true` (res si és `false`) i accés a `Gestió GM`.
  - `src/components/characters/CharacterTabNav.tsx`: navegació accessible WAI-ARIA (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, tecles `ArrowLeft`, `ArrowRight`, `Home`, `End`) amb l'ordre exacte de les 5 pestanyes.
  - `src/components/characters/TabPlaceholder.tsx`: estat coherent i honest per a les pestanyes 2–5 sense botons falsos.
  - `src/components/characters/RollModeToggle.tsx`: selector accessible de 3 estats (`Des` / `Norm` / `Ava`).
  - `src/components/characters/CharacterGmManageModal.tsx`: modal exclusiu de GM per configurar `gmNotes`, `playerEditableFields`, `authorizedOverrideFields` i `gmOnlyFields`.
- **Primera pestanya «Característiques i combat» (`src/components/characters/combat/`):**
  - `CombatStatsTab.tsx`: maquetació responsive en columnes (`grid-cols-1 lg:grid-cols-12`).
  - `AbilityScoresGrid.tsx`: les 6 característiques (`ABILITY_KEYS`) amb puntuació base editable i modificador calculat pel servidor.
  - `SavingThrowsCard.tsx`: les 6 salvacions (competents i no competents), competència, override GM (només si autoritzat) i `savingThrows.rollModes`.
  - `SkillsCard.tsx`: les 18 habilitats oficials des de `DND5E_SKILLS` (sense amagar-ne cap), diferenciació visual d'Expertesa / Competent / ½ Competència / Sense competència, percepcions passives del servidor, `skills.rollModes` i override GM (només si autoritzat).
  - `CombatVitalsCard.tsx`: PV actuals/màxims/temporals amb barra visual, CA (`computed.combat.armorClass`), iniciativa (`computed.combat.initiative`), velocitats (`walk`, `fly`, `swim`, `climb`), daus de cop exactament des de `computed.combat.hitDicePool` (mostrant avís explícit sense inventar distribució quan `hasUnallocatedLegacyUsage === true`) i 3×2 marcadors de salvació contra la mort.
  - `AttacksCard.tsx`: llistat automàtic d'armes equipades (`equipped_weapon` sense duplicar inventari) i atacs manuals des de `computed.combat.attacks`, més formulari controlat per `kind` (`unarmed`, `spell`, `special`, i `gm_custom` només per a GM/autoritzats) i bloqueig d'edició/eliminació de `gm_custom` per a jugadors.

---

## 4. Fitxers nous i modificats

### Fitxers nous
- `src/app/campaigns/[id]/characters/[characterId]/page.tsx`
- `src/components/characters/types.ts`
- `src/components/characters/sheet-permissions.ts`
- `src/components/characters/sheet-patch.ts`
- `src/components/characters/RollModeToggle.tsx`
- `src/components/characters/CharacterHeader.tsx`
- `src/components/characters/CharacterTabNav.tsx`
- `src/components/characters/TabPlaceholder.tsx`
- `src/components/characters/CharacterGmManageModal.tsx`
- `src/components/characters/CharacterSheetClient.tsx`
- `src/components/characters/combat/AbilityScoresGrid.tsx`
- `src/components/characters/combat/SavingThrowsCard.tsx`
- `src/components/characters/combat/SkillsCard.tsx`
- `src/components/characters/combat/CombatVitalsCard.tsx`
- `src/components/characters/combat/AttacksCard.tsx`
- `src/components/characters/combat/CombatStatsTab.tsx`
- `tests/phase3c1-character-sheet-ui.test.ts`
- `PHASE_3C_1_UI_FOUNDATION.md`

### Fitxers modificats
- `src/themes/fantasy-classic.css` (afegides `.rol-sheet-banner` i `.rol-stat-plaque` utilitzant exclusivament les variables `--rol-*` existents)
- `src/components/campaigns/CampaignDetailClient.tsx` (enllaços d'accés directe a `/campaigns/[id]/characters/[characterId]` mantenint el modal de gestió ràpida)
- `ROADMAP.md` (actualització de progrés de Fase 3: 3C.1 completat; 3C.2–3C.4 pendents)

---

## 5. Decisions visuals

- **Integració amb `AppShell` i `fantasy-classic`:** reutilització íntegra de la paleta de pergamí càlid (`--rol-bg-canvas`, `--rol-bg-surface`, `--rol-bg-surface-alt`), accents carmesí i daurat (`--rol-accent-primary`, `--rol-accent-gold`), tipografia display `--rol-font-display`, components `Card`, `Button`, `Badge`, `Modal` i icones `lucide-react` (sense emojis ni fons competitius).
- **Jerarquia i responsivitat:** capçalera en dues files compactes que a mòbil agrupa nom, nivell total i plaques vitals en graella `grid-cols-2 sm:grid-cols-5`; barra de pestanyes amb desplaçament horitzontal net en pantalles estretes; primera pestanya apilada a mòbil/tauleta i distribuïda en `12` columnes a escriptori.

---

## 6. Proves executades i resultats exactes

Totes les comprovacions s'han executat després d'escriure tots els fitxers de codi i proves:

- **`npm.cmd run typecheck`** (`tsc --noEmit`): **Superat (codi de sortida 0)** — `0` errors.
- **`npm.cmd test`** (`vitest run`): **Superat (codi de sortida 0)** — **11 fitxers de prova superats (11)**, **41 proves superades (41)**, `0` errors, `0` omeses, durada `50.33s`:
  - `tests/phase3c1-character-sheet-ui.test.ts` (3 tests) — `16126ms`
    1. Validació de permisos i construcció de patches mínims (exclusió d'overrides protegits, preservació de `gm_custom`, bloqueig de camps il·legals a `special`, no invenció de `hitDiceUsedByDie` en fitxes antigues).
    2. Renderitzat SSR (`renderToStaticMarkup`): 10 camps de capçalera des de `computed`, absència de botons falsos de dau virtual, exactitud de les 5 pestanyes, 6 característiques, 6 salvacions, totes les 18 habilitats oficials, atacs equipats i manuals, i avís conservador de daus de cop antics.
    3. Integració real amb BD i serveis: GM edita qualsevol fitxa i notes privades; jugador consulta fitxes compartides en lectura, edita només la seva pròpia fitxa (característiques, `rollModes`, salvacions contra la mort), rep `403 CHARACTER_EDIT_FORBIDDEN` en fitxa aliena, rep `403 OFFICIAL_CALCULATION_PROTECTED` en overrides oficials i mai rep `gmNotes` ni `fieldPermissions`.
  - Resta de la suite existent (`10` fitxers, `38` tests): tots superats sense regressions.
- **`npm.cmd run build`** (`next build`, Next.js 16.4.6 Turbopack): **Superat (codi de sortida 0)** — compilació en `5.8s`, TypeScript en `14.2s`, `3/3` pàgines estàtiques generades en `259ms`, ruta dinàmica `/campaigns/[id]/characters/[characterId]` generada correctament.

---

## 7. Limitacions detectades i repartiment pendent (3C.2, 3C.3 i 3C.4)

- **Limitacions del 3C.1:**
  - Els endpoints HTTP dedicats per a tirades de dau virtual (`executeVirtualD20Check`) i descansos (`buildShortRestPatch` / `buildLongRestPatch`) no existeixen encara al backend; per això s'ha mostrat només estat passiu sense botons simulats.
  - Els atacs manuals es poden crear i eliminar al 3C.1, mentre que l'enllaç/edició detallada d'armes físiques de l'inventari s'unificarà amb la gestió completa d'inventari al 3C.2.
- **Pendent per a l'Increment 3C.2:** Pestanyes **«Màgia i habilitats»** (fonts de conjuració per classe, llista de conjurs, espais de conjur, trets, competències i recursos) i **«Equipament i inventari»** (armes, armadures, sintonització, càrrega i monedes).
- **Pendent per a l'Increment 3C.3:** Pestanyes **«Història i diari»** (identitat completa, rerefons i notes de sessió) i **«Progressió i evolució»** (multiclasse, PE, ASI, fites i `levelHistory`).
- **Pendent per a l'Increment 3C.4:** Endpoints i UI de descans curt/llarg (amb seguiment per mida i gestió de fitxes antigues), botons i historial de dau virtual controlat per `virtualDiceEnabled`, camps personalitzats i còpia selectiva de configuració entre campanyes.
