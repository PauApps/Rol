# Fase 3 — Increment 3C.2.1: Creació guiada i configuració editable de personatges

**Data de tancament:** 2026-11-25  
**Repositori / branca:** `PauApps/Rol` (`main`, sobre `4883b07`)  
**Estat:** Implementat i verificat (`typecheck`, 47/47 proves Vitest i `next build` en verd)

---

## 1. Abast i confirmacions estructurals

Aquest increment implementa la creació guiada en 6 passos (`/campaigns/[id]/characters/new`) i l’edició post-creació de la configuració bàsica des de la fitxa universal (`CharacterIdentityConfigModal`), compartint íntegrament el model universal `v2` de D&D 5e (2014), les regles del motor pur de l’Increment 3B i les validacions del servidor.

- **Zero canvis en capes protegides:** No s’han modificat `src/server/services/character-service.ts`, cap ruta de `src/app/api/**`, `src/db/**` ni les migracions `drizzle/**`.
- **Sense treball fora d’abast:** No s’ha iniciat l’Increment 3C.3 (Història i diari / Progressió i evolució) ni el 3C.4 (Descansos i dau virtual), ni s’han afegit paquets npm externs.
- **Sense accions git destructives ni publicació:** No s’ha fet `git commit` ni `git push`.

---

## 2. Funcionalitats implementades

### 2.1. Catàleg pur oficial D&D 5e (2014) per a creació (`creation-catalog.ts`)
S’ha creat el mòdul pur `src/domain/systems/dnd5e-2014/creation-catalog.ts` (reexportat des de `src/domain/systems/dnd5e-2014/index.ts`) amb:
- **9 races oficials i subraces:** Humà (estàndard i variant), Elf (Alt elf, Elf del bosc, Elf fosc/Drow), Nan (Nan dels turons, Nan de la muntanya), Mitjà/Halfling (Peuslleugers, Robust), Dracònid, Gnom (Gnom dels boscos, Gnom de les roques), Mig-elf (+2 CAR i +1 a dues característiques a escollir), Mig-orc i Tiefling, amb àlies de coincidència (`humà`/`human`, etc.), velocitats (`walk` en metres enters: `8`, `9`, `10` per coherència amb el model existent), mida, sentits, idiomes, habilitats i trets racials.
- **8 antecedents clàssics:** Acòlit, Erudit / Savi, Soldat, Criminal, Noble, Ermità, Foraster i Animador, cadascun amb les 2 habilitats fixes oficials, competències d’eines/idiomes, or i paquet d’equipament inicial, i tret d’antecedent.
- **Les 12 classes oficials (`DND5E_CLASS_CREATION_RULES`):** Bàrbar, Bard, Bruixot, Clergue, Druida, Explorador, Fetiller, Guerrer, Monjo, Mag, Paladí i Pícar, amb selecció de subclasse a nivell 1 (Clergue, Bruixot, Fetiller) o a partir del nivell de desbloqueig oficial (nivell 2 o 3), tirades de salvació automàtiques, nombre i llista d’habilitats elegibles, competències d’armadures/armes, estils de combat (`DND5E_FIGHTING_STYLES`) i paquets d’equipament oficials amb propietats mecàniques (`armorType`, `baseAc`, `damage`, `damageType`, `weaponRange`, `weaponProperties`).
- **Generació d’atributs i càlculs purs:** `STANDARD_ARRAY_2014`, `POINT_BUY_BUDGET_2014` (`27`), `POINT_BUY_COSTS_2014`, `calculatePointBuyCost`, `enumerateValidRacialBonusVectors`, `validateAbilityScoresAgainstMethod`, `roll4d6DropLowestSet` i `calculateStartingHitPoints` (amb suport a Tenacitat nans +1 PV/nivell).

### 2.2. Validació d’`abilityScoreMethod` al servidor (`creation-validator.ts`)
S’ha estès `validateCharacterAgainstCampaignConfig` a `src/domain/systems/dnd5e-2014/creation-validator.ts`:
- Valida `abilityScoreMethod` (`free`, `standard_array`, `point_buy`, `rolled_4d6_drop_lowest`, `manual_gm`) quan `options.isCreation === true` i `config.abilityScoreMethod !== 'free'`.
- En mode `manual_gm`, bloqueja jugadors que intentin fixar atributs directament (`strict` bloqueja; `guided` avisa; el GM conserva autoritat d’excepció).
- Quan s’aporten puntuacions inicials (`anyScoreDefined`), comprova les puntuacions finals respecte al pressupost de compra de punts (27 punts), array estàndard o rang `4d6` tenint en compte tots els vectors racials vàlids de la raça/subraça i les ASI desbloquejades segons `startingLevel`. Quan cap característica no ve definida al payload inicial, manté la compatibilitat retroactiva amb la creació ràpida existent.
- Afegeix `isAllowedRaceMatch` i `isAllowedBackgroundMatch` amb normalització d’accents i àlies oficials.

### 2.3. Assistent de creació guiada en 6 passos (`/campaigns/[id]/characters/new`)
- Ruta dedicada `src/app/campaigns/[id]/characters/new/page.tsx` protegida per sessió, UUID i accés de campanya (`getCampaignDetail` + `listCampaignCharacters`).
- `CharacterCreationWizardClient.tsx` + `wizard-state.ts` + 6 components de pas:
  1. `StepIdentity.tsx`: Nom, alineament, assignació a jugador (només GM), selecció de raça/subraça i classe/subclasse/nivell respectant `freedomMode`, llistes permeses i `startingLevel`, més descripció/història si `requiredFields` les marca obligatòries.
  2. `StepAbilities.tsx`: Selecció per al mètode configurat a la campanya (`standard_array`, `point_buy`, `rolled_4d6_drop_lowest`, `manual_gm`, `free`), selector de bonificadors racials flexibles (p. ex. Mig-elf i Humà variant), i previsualització `base + racial = final (modificador)`.
  3. `StepBackgroundProficiencies.tsx`: Antecedent (catàleg oficial o personalitzat), habilitats sense duplicats entre raça, antecedent i classe, salvacions automàtiques i competències d’armadura, armes, eines i idiomes.
  4. `StepClassFeatures.tsx`: Punts de vida inicials (mitjana oficial PHB o personalitzat pel GM), estil de combat si aplica, previsualització en temps real de recursos amb `computeCharacterResources` i bloc de màgia actiu per a classes llançadores (característica, CD de salvació, atac de conjur, límit de preparats i alta inicial opcional de conjurs).
  5. `StepEquipment.tsx`: Paquets oficials d’equipament per classe i antecedent, activació d’equipat, or inicial, objectes addicionals i previsualització en viu de CA i atacs derivats amb `computeDnd5e2014Character`.
  6. `StepReview.tsx`: Resum complet, mètriques derivades, enllaços per tornar a cada pas i validació en temps real amb `validateCharacterAgainstCampaignConfig`.
- Botó d’accés directe **«Creació guiada (6 passos)»** integrat a `src/components/campaigns/CampaignDetailClient.tsx`.

### 2.4. Configuració editable des de la fitxa universal
- Nou modal `src/components/characters/CharacterIdentityConfigModal.tsx` accessible des de `CharacterHeader.tsx` (botó «Identitat i classes») i connectat a `CharacterSheetClient.tsx`.
- Permet editar de manera parcial (`PATCH /api/campaigns/[id]/characters/[characterId]`) la identitat, mida, sentits, raça/subraça, classes/subclasses/nivells (amb límit total de nivell `20`), antecedent i competències (`armor`, `weapons`, `tools`, `languages`), bloquejant camps quan el jugador no té permís (p. ex. `raceAndClass` segons `fieldPermissions` o `gmOnly`).

---

## 3. Fitxers nous i modificats

### Nous
- `src/domain/systems/dnd5e-2014/creation-catalog.ts`
- `src/components/characters/creation/wizard-state.ts`
- `src/components/characters/creation/StepIdentity.tsx`
- `src/components/characters/creation/StepAbilities.tsx`
- `src/components/characters/creation/StepBackgroundProficiencies.tsx`
- `src/components/characters/creation/StepClassFeatures.tsx`
- `src/components/characters/creation/StepEquipment.tsx`
- `src/components/characters/creation/StepReview.tsx`
- `src/components/characters/creation/CharacterCreationWizardClient.tsx`
- `src/app/campaigns/[id]/characters/new/page.tsx`
- `src/components/characters/CharacterIdentityConfigModal.tsx`
- `tests/phase3c21-character-creation.test.ts`
- `PHASE_3C_2_1_CHARACTER_CREATION.md`

### Modificats
- `src/domain/systems/dnd5e-2014/index.ts`
- `src/domain/systems/dnd5e-2014/creation-validator.ts`
- `src/components/campaigns/CampaignDetailClient.tsx`
- `src/components/characters/CharacterHeader.tsx`
- `src/components/characters/CharacterSheetClient.tsx`
- `ROADMAP.md`

---

## 4. Verificació executada després del darrer canvi de codi

1. `npm.cmd run typecheck` → **0 errors** (`---TYPECHECK_OK---`).
2. `npm.cmd test` → **13 fitxers de prova passats (13/13), 47 proves passades (47/47)**, incloent les 3 proves noves a `tests/phase3c21-character-creation.test.ts` (generació d’atributs i bonificacions racials; creació de les 12 classes oficials amb càlculs derivats i equipament; seguretat estricte al servidor, `CHARACTER_LIMIT_REACHED`, `OFFICIAL_CALCULATION_PROTECTED`, `gmNotes` ocultes, `PATCH` d’identitat/multiclasse i renderització SSR dels 6 passos + modal d’identitat).
3. `npm.cmd run build` → **Compilació de producció completada sense errors** (`---BUILD_OK---`), amb `/campaigns/[id]/characters/new` generat com a ruta dinàmica (`ƒ`).

---

## 5. Limitacions conegudes i elements fora d’abast

- **Catàleg oficial de conjurs pendent:** Com que el domini encara no disposa d’un catàleg oficial de conjurs de D&D 5e 2014, el Pas 4 permet donar d’alta conjurs inicials manualment respectant l’estructura i els límits de preparats/espais de l’Increment 3B.
- **ASI en nivells ≥ 4 dins `standard_array` / `point_buy`:** La validació admet un pressupost de `+2` punts d’ASI per cada millora desbloquejada al nivell inicial de campanya sense exigir un històric de selecció d’ASI per nivell, mentre aquest sigui cobert a l’Increment 3C.3 («Progressió i evolució»).
- **Elements pendents deliberadament:** Pestanyes «Història i diari» i «Progressió i evolució» (3C.3) i endpoints/UI de descansos curt/llarg i dau virtual (3C.4).
