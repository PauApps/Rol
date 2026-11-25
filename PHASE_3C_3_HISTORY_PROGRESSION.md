# Fase 3 — Increment 3C.3: Història, diari, progressió i evolució del personatge

**Data de tancament:** 2026-11-25  
**Repositori / branca:** `PauApps/Rol` (`main`, en local pendent de commit/push)  
**Estat:** Implementat i verificat (`typecheck`, 50/50 proves Vitest i `next build` en verd)

---

## 1. Abast i preservació de canvis locals

Aquest increment implementa les dues darreres pestanyes de la fitxa universal de personatge (**«Història i diari»** i **«Progressió i evolució»**), completant les cinc pestanyes de la fitxa sense iniciar l’Increment 3C.4 i sense executar `git commit` ni `git push`.

S’han preservat íntegrament tots els canvis locals previs pendents de publicació:
- **Eliminació amb doble confirmació:** `deleteCampaignCharacter` a `src/server/services/character-service.ts`, endpoint `DELETE /api/campaigns/[id]/characters/[characterId]`, registre `character.deleted` a `audit_logs` i modal en 2 passos `DeleteCharacterModal.tsx`.
- **Edició ampliada i accessos:** camps `speed.walk`, `appearanceNotes`, `backstory` i reassignació de titularitat del GM a `CharacterIdentityConfigModal.tsx`, accessos directes des de `CampaignDetailClient.tsx` (`Editar` amb `?edit=1`, `Eliminar`) i `CharacterHeader.tsx` (`Editar personatge`, `Eliminar`).

---

## 2. Funcionalitats implementades

### Part A — Història i diari
- **Pestanya integrada (`StoryAndJournalTab.tsx`, `CharacterStoryCard.tsx`):**
  - Edició còmoda i unificada de tots els camps narratius existents al model `v2`: antecedent/origen (`background.backgroundName`), alineament (`generalInfo.alignment`), fe/deïtat (`generalInfo.faith`), edat (`generalInfo.age`), mida (`generalInfo.size`), sentits (`generalInfo.senses`), descripció física i aspecte (`generalInfo.appearanceNotes`), trets de personalitat (`background.personalityTraits`), ideals (`background.ideals`), vincles (`background.bonds`), defectes (`background.flaws`), història personal (`background.backstory`) i objectius personals / notes narratives (`background.additionalNotes`).
  - **Zero duplicació de dades:** `background.backstory`, `background.backgroundName` i `generalInfo.appearanceNotes` apunten exactament als mateixos camps que el modal `CharacterIdentityConfigModal.tsx` i la creació guiada.
- **Diari cronològic (`CharacterJournalCard.tsx`):**
  - Entrades individuals dins `background.sessionNotes` amb títol, contingut, data, `updatedAt` i categoria opcional (`Esdeveniments`, `Personatges coneguts`, `Llocs descoberts`, `Missions`, `Objectius`, `Records`, `Notes lliures` o *Sense categoria*).
  - Filtre per categoria, ordenació cronològica (*Més recents primer* / *Més antigues primer*), creació, edició i eliminació amb confirmació en dos passos (*Eliminar* → *Confirmar eliminació*).

### Part B — Progressió i evolució
- **Resum d’experiència i nivell (`ProgressionSummaryCard.tsx`):**
  - Mostra nivell total (`1–20`), bonificació de competència, experiència actual, llindars oficials del motor (`XP_THRESHOLDS_2014`), barra de progrés cap al nivell següent, inspiració heroica i botó d’edició directa de PE/delta segons permisos.
- **Multiclasse i fites (`MulticlassBreakdownCard.tsx`, `src/domain/systems/dnd5e-2014/progression.ts`):**
  - Desglossament per classe i subclasse, dau de cop, mitjana de PV, ASI desbloquejades i pròxima ASI, beneficis oficials desbloquejats fins al nivell de classe actual, fites properes calculades pel motor (`computeProgression`) i comprovació dels requisits oficials de multiclasse de D&D 5e 2014 (PHB p. 163).
- **Assistent de pujada de nivell (`LevelUpModal.tsx`) i historial (`LevelHistoryCard.tsx`):**
  - Permet pujar +1 nivell en una classe existent o afegir una nova classe en multiclasse amb previsualització pura (`previewLevelUp` i `buildLevelUpPatch`):
    - Càlcul d’increment de PV (mitjana oficial + CON + Tenacitat nans, o tirada/personalitzat validat).
    - Elecció de subclasse quan s’arriba al nivell oficial de desbloqueig.
    - ASI (`+2`, `+1/+1` amb topall 20 per a no-GM) o Dot (*Feat*) quan correspon per classe/nivell.
    - Trets de classe desbloquejats al nou nivell (amb alta opcional a `traitsAndFeatures`).
    - Competències i habilitats de multiclasse (PHB p. 164).
    - Delta en temps real d’espais de conjur, Màgia de Pacte, límit de preparats i recursos, amb opció d’afegir nous conjurs.
    - Registre automàtic a `progression.levelHistory` i `progression.abilityScoreImprovements` sense alterar inventari, monedes ni diari.
- **Sincronització entre les 5 pestanyes (`CharacterSheetClient.tsx`):**
  - En aplicar una pujada de nivell o desar canvis parcials, s’actualitzen immediatament la capçalera persistent, les característiques i atacs, la pestanya de màgia i recursos, l’inventari i els valors narratius.

---

## 3. Decisions tècniques, model de dades, API i migracions

- **Sense canvis de taules BD ni migracions SQL:** El model `v2` JSONB (`background.sessionNotes`, `background.*`, `generalInfo.*`, `progression.*`, `raceAndClass.classes`) ja donava suport a tota l’estructura narrativa i de progressió. Només s’han afegit dos camps opcionals retrocompatibles dins `Dnd5e2014SessionNote` (`updatedAt` i `category`, normalitzats a `null` per defecte a `schema.ts` i `validation.ts`).
- **Validació al servidor de multiclasse (`character-service.ts`):** Quan s’actualitza `raceAndClass.classes` amb 2 o més classes, el servidor executa `validateMulticlassPrerequisites`: bloqueja els jugadors no-GM amb `400 MULTICLASS_PREREQUISITES_NOT_MET` si no assoleixen els mínims de D&D 5e (PHB p. 163) i emet advertiments al GM per conservar la seva autoritat d’excepció.
- **Canvi granular a `DEFAULT_PLAYER_EDITABLE_FIELDS` (`permissions.ts`):** S’ha desglossat `raceAndClass` (`raceAndClass.race`, `raceAndClass.subrace`) i `progression` (`progression.inspiration`, `progression.abilityScoreImprovements`, `progression.levelHistory`), deixant `raceAndClass.classes`, `progression.experiencePoints` i `progression.totalLevel` sota control del GM per defecte, amb `GM_GRANTABLE_PLAYER_FIELDS` disponible al modal `CharacterGmManageModal.tsx` si el GM vol autoritzar-los explícitament a un jugador.
- **Sense modificació d’endpoints REST:** El flux complet opera sobre els `PATCH` parcials existents a `/api/campaigns/[id]/characters/[characterId]`, mantenint intacte el nou `DELETE`.

---

## 4. Permisos i limitacions conegudes

- **Permisos aplicats al servidor i a la UI:**
  - `gmNotes` i seccions marcades a `gmOnlyFields` (incloent ara `background.sessionNotes` i `background.additionalNotes`) no s’exposen mai al jugador ni poden ser modificats.
  - Els jugadors sense permís explícit per a `progression.experiencePoints`, `progression.totalLevel` o `raceAndClass.classes` veuen un estat clar de només consulta i qualsevol petició manipulada és rebutjada al servidor amb `403 FIELD_EDIT_NOT_AUTHORIZED` (i `403 OFFICIAL_CALCULATION_PROTECTED` per a overrides).
- **Limitació coneguda (privacitat individual d’entrades del diari):** Tal com s’ha acordat, no existeix un sistema de visibilitat per entrada individual (pública/privada) al model: totes les entrades de `background.sessionNotes` comparteixen la visibilitat general de la fitxa dins la campanya, amb l’única possibilitat d’ocultar la secció sencera mitjançant `gmOnlyFields` o usar `gmNotes` per a secrets exclusius del GM.
- **Funcionalitats no implementades (fora d’abast):** Descans curt/llarg interactiu, dau virtual integrat a la UI i gestió de `customFields` (ajornats deliberadament a l’**Increment 3C.4**).

---

## 5. Fitxers nous i modificats

### Nous
- `src/domain/systems/dnd5e-2014/progression.ts`
- `src/components/characters/story/CharacterStoryCard.tsx`
- `src/components/characters/story/CharacterJournalCard.tsx`
- `src/components/characters/story/StoryAndJournalTab.tsx`
- `src/components/characters/progression/ProgressionSummaryCard.tsx`
- `src/components/characters/progression/MulticlassBreakdownCard.tsx`
- `src/components/characters/progression/LevelHistoryCard.tsx`
- `src/components/characters/progression/LevelUpModal.tsx`
- `src/components/characters/progression/ProgressionAndEvolutionTab.tsx`
- `tests/phase3c3-history-and-progression.test.ts`
- `PHASE_3C_3_HISTORY_PROGRESSION.md`

### Modificats
- `src/domain/systems/dnd5e-2014/schema.ts`
- `src/domain/systems/dnd5e-2014/validation.ts`
- `src/domain/systems/dnd5e-2014/permissions.ts`
- `src/domain/systems/dnd5e-2014/index.ts`
- `src/server/services/character-service.ts`
- `src/components/characters/types.ts`
- `src/components/characters/sheet-patch.ts`
- `src/components/characters/CharacterGmManageModal.tsx`
- `src/components/characters/CharacterSheetClient.tsx`
- `ROADMAP.md`

---

## 6. Proves executades i resultats

1. `npm.cmd run typecheck` → **0 errors** (`tsc --noEmit`).
2. `npm.cmd test` → **14 fitxers de prova passats (14/14), 50 proves passades (50/50)**, incloent:
   - Nova suite `tests/phase3c3-history-and-progression.test.ts` (domini de multiclasse/level-up/ASI/concordança de patches, integració en BD d’història compartida, diari amb categories/edició/eliminació/permisos, autoritat del GM sobre PE/nivell, multiclasse legal i bloqueig de multiclasse il·legal al servidor, renderització SSR i regressió d’eliminació).
   - Sense regressions a la creació guiada (`3C.2.1`), edició/eliminació de personatges, `3C.2`, `3C.1`, `3B` i `Fase 2`.
3. `npm.cmd run build` → **Compilació Next.js 16.4.6 completada sense errors**.
