# Correcció crítica — Increment 3C.3: Control de pujades de nivell per punts d’experiència

**Data:** 2026-11-25  
**Branca:** `main` (en local, pendent de validació funcional i de commit/push)  
**Estat de l’Increment 3C.3:** Correcció aplicada; **pendent de validació funcional** abans de tancar l’increment.

---

## 1. Causa arrel del bug

A la implementació inicial de l’Increment 3C.3 s’havien produït tres buits acumulatius entre domini, servidor i interfície:

1. **`progression.ts` (`previewLevelUp` / `buildLevelUpPatch`):** Només comprovaven que el personatge no hagués arribat al nivell màxim (`20`) i que no es repetís una classe oficial en multiclasse, però **no validaven els punts d’experiència acumulats** (`experiencePoints`) contra el llindar oficial (`XP_THRESHOLDS_2014`) del nivell següent (`nextTotalLevel`).
2. **`character-service.ts` (`updateCharacterBase`):** Acceptava qualsevol `PATCH` sobre `raceAndClass.classes` / `progression.totalLevel` (fins al nivell 20 i complint multiclasse) **sense verificar**:
   - si els PE reals persistits a la BD arribaven al llindar del nivell següent,
   - si la petició incrementava exactament `+1` nivell respecte al nivell actual real (evitant salts de nivell),
   - si s’enviava un estat obsolet (`expectedCurrentLevel` / `expectedUpdatedAt`) o dues peticions concurrents sobre el mateix estat.
3. **`ProgressionSummaryCard.tsx` i `LevelUpModal.tsx`:** El botó **«Pujar de nivell (+1)»** només quedava bloquejat si hi havia canvis sense desar o al nivell `20`, i `LevelUpModal` no bloquejava l’acció ni sincronitzava l’estat si el jugador intentava pujar repetidament sense PE suficients o amb un estat obsolet.

---

## 2. Fitxers modificats

- `src/domain/systems/dnd5e-2014/progression.ts`
- `src/domain/systems/dnd5e-2014/validation.ts`
- `src/server/services/character-service.ts`
- `src/components/characters/progression/ProgressionSummaryCard.tsx`
- `src/components/characters/progression/LevelUpModal.tsx`
- `src/components/characters/progression/ProgressionAndEvolutionTab.tsx`
- `src/components/characters/CharacterSheetClient.tsx`
- `tests/phase3c3-history-and-progression.test.ts`
- `ROADMAP.md`
- `PHASE_3C_3_LEVEL_UP_FIX.md` *(nou informe)*

---

## 3. Solució aplicada

### 3.1. Validació centralitzada al domini (`progression.ts`)
S’ha afegit `evaluateLevelUpEligibility(sheet, options?)`, que reutilitza directament `calculateTotalLevel` i `computeProgression` (`XP_THRESHOLDS_2014`, sense duplicar taules ni fórmules) i retorna un resultat estructurat amb `allowed`, `code`, `reason`, `currentLevel`, `nextLevel`, `currentXp`, `requiredXpForNextLevel` i `xpMissing`:
- Comprova que el personatge tingui almenys una classe (`LEVEL_UP_NO_CLASS`).
- Comprova el sostre oficial de nivell `20` (`LEVEL_UP_MAX_LEVEL_REACHED`).
- Comprova que la pujada sigui exactament de `+1` nivell i no salti nivells (`LEVEL_UP_SKIP_FORBIDDEN`) ni arribi amb un `targetLevel <= currentLevel` o `expectedCurrentLevel` obsolet (`STALE_LEVEL_UP_STATE`).
- Comprova que `currentXp >= requiredXpForNextLevel` (`INSUFFICIENT_XP_FOR_LEVEL_UP`).
- `previewLevelUp()` i `buildLevelUpPatch()` consumeixen `evaluateLevelUpEligibility()` directament i exposen `xp` (`currentXp`, `requiredXpForNextLevel`, `xpMissing`, `hasEnoughXp`) i `eligibilityCode`. Els PE són estrictament acumulatius i **no es consumeixen** mai.

### 3.2. Correccions a la interfície (`ProgressionSummaryCard`, `LevelUpModal`, `CharacterSheetClient`)
- `ProgressionSummaryCard.tsx`: avalua l’elegibilitat sobre les dades persistides al servidor (`character.sheetData`, mai sobre PE no desats a l’esborrany), desactiva el botó **«Pujar de nivell (+1)»** quan falten PE o hi ha canvis sense desar, i mostra clarament quants PE falten o quan ja es pot pujar al nivell següent.
- `LevelUpModal.tsx`: mostra sempre nivell actual/següent i `PE acumulats / PE requerits`, explica que els PE no es consumeixen, desactiva el botó de confirmació quan `!preview.canLevelUp`, evita dobles clics (`inFlightRef` + `submitting`), envia `expectedCurrentLevel` i `expectedUpdatedAt`, i si el servidor rebutja l’operació mostra el missatge d’error i invoca `onSyncFromServer()` (`GET /api/campaigns/[id]/characters/[characterId]`) per resincronitzar fitxa i esborrany amb l’estat real del servidor.

---

## 4. Proteccions implementades al servidor

Dins `updateCharacterBase()` (`src/server/services/character-service.ts`) i `updateCharacterRequestSchema` (`validation.ts`):

1. **Transacció amb bloqueig de fila (`SELECT ... FOR UPDATE`):** Tota la lectura, validació i escriptura d’una actualització de personatge s’executa dins `db.transaction` bloquejant la fila en curs, evitant condicions de carrera quan arriben peticions simultànies.
2. **Validació amb dades reals del servidor:** En detectar `nextTotalLevel > currentTotalLevel`, `evaluateLevelUpEligibility()` comprova sempre `existingNormalized` carregat dins la transacció (ignorant qualsevol càlcul o requisit confiat pel client).
3. **Prohibició de mutar/consumir PE dins la mateixa operació de pujada:** Si en pujar de nivell s’intenta alterar `progression.experiencePoints`, el servidor rebutja amb `400 LEVEL_UP_XP_MUTATION_FORBIDDEN`.
4. **Prohibició de saltar nivells i de superar el nivell 20:** `400 LEVEL_UP_SKIP_FORBIDDEN`, `400 LEVEL_UP_MAX_LEVEL_REACHED` i validació Zod `MAX_OFFICIAL_LEVEL_2014 = 20`.
5. **Control optimista i d’estat obsolet (`409 STALE_LEVEL_UP_STATE`):** Validació opcional d’`expectedCurrentLevel` i `expectedUpdatedAt` (acceptada per `updateCharacterRequestSchema`), juntament amb `updatedAt` monòton (`Math.max(Date.now(), existing.updatedAt.getTime() + 1)`) i `UPDATE ... WHERE updated_at = existing.updatedAt`. Dues peticions simultànies no poden provocar una doble pujada sobre el mateix estat inicial.

---

## 5. Proves afegides i resultats reals

Ampliada la suite `tests/phase3c3-history-and-progression.test.ts` cobrint tots els casos obligatoris:
1. Nivell 1 amb 299 PE → domini, servidor (`400 INSUFFICIENT_XP_FOR_LEVEL_UP`) i SSR (`ProgressionSummaryCard` i `LevelUpModal`) rebutgen/desactiven la pujada.
2. Nivell 1 amb 300 PE → permet pujar a nivell 2 i conserva els 300 PE.
3. Després de pujar a nivell 2 amb 300 PE → rebutja una segona pujada i rebutja una petició repetida amb `expectedCurrentLevel: 1` (`409 STALE_LEVEL_UP_STATE`).
4. Nivell 2 amb 899 PE → rebutja la pujada (`400 INSUFFICIENT_XP_FOR_LEVEL_UP`).
5. Nivell 2 amb 900 PE → permet arribar a nivell 3 i conserva els 900 PE.
6. Personatge a nivell 1 amb 900 PE → pot pujar successivament `1 → 2 → 3` conservant els 900 PE, rebutja saltar `1 → 3` (`400 LEVEL_UP_SKIP_FORBIDDEN`) i rebutja `3 → 4` (`900 < 2700`).
7. Petició manipulada combinant pujada + canvi de PE → rebutjada (`400 LEVEL_UP_XP_MUTATION_FORBIDDEN`).
8. Petició repetida amb estat obsolet → rebutjada (`409 STALE_LEVEL_UP_STATE`).
9. Dues peticions simultànies (`Promise.allSettled`) contra el mateix personatge a nivell 1 amb 900 PE → exactament 1 s’aplica (acaba a nivell 2 amb 1 sola entrada a `levelHistory`) i l’altra és rebutjada (`409 STALE_LEVEL_UP_STATE`).
10. Nivell 20 amb 500.000 PE → rebutja superar el límit màxim (`LEVEL_UP_MAX_LEVEL_REACHED`).
11. Preservació de PV, capacitats, conjurs, recursos, multiclasse i historial.

### Resultats de validació executats després del darrer canvi de codi
- `npm.cmd run typecheck` → **0 errors**.
- `npm.cmd test` → **14 fitxers passats (14/14), 51 proves passades (51/51)**.
- `npm.cmd run build` → **Compilació de producció Next.js 16.4.6 completada sense errors**.

---

## 6. Limitacions o riscos pendents

- **Campanyes per fites (*Milestone*):** Si una taula vol pujar personatges sense utilitzar PE acumulats, actualment el servidor exigeix els llindars oficials d’experiència per a tota pujada de nivell en `updateCharacterBase`; un futur selector de mode de progressió (*PE* vs *Milestone*) requeriria configuració de campanya específica.
- **Edició directa des de `CharacterIdentityConfigModal`:** Com que la protecció de nivell actua al servidor per a qualsevol increment de `totalLevel` en `updateCharacterBase`, si un GM intenta incrementar el nivell d’un personatge des del modal d’identitat sense haver-li assignat abans els PE corresponents, el servidor també ho bloquejarà amb `INSUFFICIENT_XP_FOR_LEVEL_UP` fins que disposi dels PE necessaris (reduir nivell o editar nom/raça/subclasse al mateix nivell continua funcionant sense restriccions).
- **Validació funcional pendent:** L’Increment 3C.3 roman obert fins a verificar aquest comportament manualment en local abans de tancar-lo definitivament.
