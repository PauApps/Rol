# Revisió correctiva de l’Increment 3B — Seguretat d’atacs, daus de cop multiclasse i màgia per classe

**Data:** 2026-11-23  
**Branca base:** `main` (sobre `e0a9aa7`)  
**Àmbit:** Domini pur (`src/domain/systems/dnd5e-2014/*`), proves i documentació (sense canvis a UI React, CSS, rutes visuals, migracions SQL ni `git push`).

---

## 1. Resum executiu

Després de revisar el codi de l’Increment 3B sobre `main`, s’han tancat les quatre bretxes detectades abans d’iniciar l’Increment 3C:

1. **Atacs vinculats a armes i atacs manuals:** eliminada qualsevol possibilitat que `computeAttacks()` utilitzi silenciosament una característica il·legal (`linked?.ability`, `item.weaponAbility` o `atk.ability`) o que un jugador s’autoatribueixi competència mitjançant `attacks[].proficient`.
2. **Categorització explícita d’atacs:** separació estricta mitjançant `AttackEntryKind` (`weapon_override`, `unarmed`, `spell`, `special`, `gm_custom`) i protecció server-side dels camins `attacks.ability`, `attacks.proficient` i `attacks.gmCustom`.
3. **Daus de cop per mida (`d6`, `d8`, `d10`, `d12`) en multiclasse:** nou control per mida amb `hitPoints.hitDiceUsedByDie` i `combat.hitDicePool`, respectant fitxes antigues amb `hitDiceUsed` global sense inventar dades perdudes.
4. **Overrides de màgia per classe:** incorporació de `spellcasting.sourceOverrides` protegit pel GM per ajustar individualment una classe en multiclasse (p. ex. Clergue vs. Mag), conservant plena retrocompatibilitat amb els overrides globals.

---

## 2. Fitxers nous i modificats

### Fitxer nou
- `PHASE_3B_CORRECTIONS.md`

### Fitxers modificats
- `src/domain/systems/dnd5e-2014/schema.ts`
- `src/domain/systems/dnd5e-2014/attacks.ts`
- `src/domain/systems/dnd5e-2014/rules.ts`
- `src/domain/systems/dnd5e-2014/rests.ts`
- `src/domain/systems/dnd5e-2014/validation.ts`
- `src/domain/systems/dnd5e-2014/permissions.ts`
- `tests/dnd5e-2014-rules-engine.test.ts`
- `tests/phase3b-domain-extensions.test.ts`
- `SECURITY.md`
- `DATABASE.md`
- `ROADMAP.md`
- `CHANGELOG.md`

*(Sense canvis a `src/app/**`, `src/components/**`, `src/server/services/character-service.ts`, CSS ni `drizzle/`.)*

---

## 3. Decisions tècniques i solucions implementades

### 3.1 Protecció dels atacs vinculats i diferenciació per tipus d’atac

S’ha introduït un model explícit de tipus d’entrada dins `Dnd5e2014AttackEntry` (`schema.ts`, `attacks.ts`):

- **`weapon_override` (vinculat via `inventoryItemId`):**
  - Les característiques oficials legals provenen exclusivament de `getAllowedOfficialWeaponAbilities(item, classes)` (p. ex. `['str']` en espasa llarga, `['dex']` en arc llarg, `['str', 'dex']` en armes *finesse* o elegibles d’Arts Marcials de Monjo).
  - En armes equipades (`equipped_weapon`) i `weapon_override`, `computeAttacks()` **mai** no aplica una característica il·legal escrita a `item.weaponAbility` o `linked?.ability`: si apareix una característica fora de les permeses en una fitxa en memòria, l’ignora i torna al càlcul oficial automàtic.
  - Les excepcions no oficials passen exclusivament pels camps protegits `inventory[].weaponAbilityOverride` i `attacks[].abilityOverride`.
  - La competència física es resol exclusivament amb `resolveWeaponProficiency(item, sheet)` (des de `proficiencies.weapons`), o bé mitjançant les excepcions del GM `item.weaponProficient` / `linked?.proficientOverride`. El camp `linked?.proficient` ja no es té en compte per atorgar competència física.

- **Atacs manuals (`inventoryItemId === null`) diferenciats per `kind`:**
  - **`unarmed`:** permet `['str']` (o `['str', 'dex']` si el personatge té nivells de `monk`) i concedeix competència oficial automàtica (`proficiencySource: 'unarmed_official'`, PHB 2014 p. 195), excepte si el GM estableix `proficientOverride` o `abilityOverride`.
  - **`spell`:** deriva l’aptitud màgica i la competència (`spellcasting_official`) de la font activa corresponent calculada pel motor (`computeSpellcasting()` / `spellSourceClassId`), aplicant tant overrides globals com `sourceOverrides` per classe; un no-llançador no pot atorgar-se aptitud ni competència màgica.
  - **`special`:** pensat per a atacs narratius, alès o trets especials introduïts pel jugador sense fórmules inventades. No accepta `ability` lliure ni autoatribució via `proficient: true`: només el GM pot aplicar `abilityOverride` o `proficientOverride`.
  - **`gm_custom`:** reservat exclusivament al Director de Joc (`attacks.gmCustom`); un jugador no pot crear, modificar ni eliminar entrades d’aquest tipus.

### 3.2 Daus de cop per mida (`d6`, `d8`, `d10`, `d12`) en multiclasse i estratègia amb fitxes antigues

- **Nou model i càlculs (`schema.ts`, `rules.ts`):**
  - Afegit `hitPoints.hitDiceUsedByDie: Partial<Record<'d6' | 'd8' | 'd10' | 'd12', number>> | null` i la vista calculada `combat.hitDicePool` (`total`, `used`, `available`, `hasUnallocatedLegacyUsage`, `unallocatedUsed` i `byDie[]`).
  - `dnd5e2014SheetSchema.superRefine` exigeix coherència estricta quan `hitDiceUsedByDie !== null`: la suma per mida ha de coincidir amb `hitDiceUsed` i cap mida pot superar la reserva de les classes del personatge.
- **Estratègia de normalització per a fitxes antigues (sense inventar dades):**
  - Si `hitDiceUsed === 0`, es normalitza directament a `{}`.
  - Si totes les classes del personatge pertanyen al catàleg oficial i comparteixen **una única mida de dau** (p. ex. monoclasse o multiclasse homogeni com Clergue + Murri amb `d8`) dins la capacitat total, `inferHitDiceUsedByDieFromClasses()` assigna els daus gastats a aquesta única mida amb certesa matemàtica.
  - Si la fitxa antiga té `hitDiceUsed > 0` amb **mides mixtes** (p. ex. Guerrer `d10` + Mag `d6`) o classe `custom` sense dau oficial, `normalizeDnd5e2014Sheet()` conserva **`hitDiceUsedByDie = null`** i exposa `hasUnallocatedLegacyUsage: true` sense inventar mai de quina mida eren els daus gastats.
- **Descans curt i llarg (`rests.ts`):**
  - `buildShortRestPatch()` valida cada mida de dau sol·licitada contra `byDie[dieSize].available` (`400 INSUFFICIENT_HIT_DICE_FOR_SIZE`) quan el seguiment per mida és actiu. Si existeix ús antic sense assignació per mida (`hitDiceUsedByDie === null && hitDiceUsed > 0`, és a dir, `hitDicePool.hasUnallocatedLegacyUsage === true`), bloqueja qualsevol despesa de daus de cop amb `400 UNALLOCATED_LEGACY_HIT_DICE` sense modificar PV ni cap altre camp.
  - `buildLongRestPatch()` recupera fins a `allowance = Math.max(1, Math.floor(totalLevel / 2))` daus tant en fitxes amb seguiment per mida (amb selecció explícita via `hitDiceToRecover` validada o recuperació `d12 → d10 → d8 → d6`) com en fitxes antigues amb `hitDiceUsedByDie === null`. En fitxes antigues, aplica estrictament `recovered = Math.min(spentDice, allowance)` i `remainingSpent = spentDice - recovered`: si `remainingSpent > 0`, conserva `hitDiceUsedByDie = null` sense inventar mides; si `remainingSpent === 0`, inicialitza `hitDiceUsedByDie = {}`.

#### Correcció de tancament — Recuperació oficial, bloqueig conservador i validació de `hitDiceToRecover` en daus de cop antics (sobre `de950ef`, `20e0c82` i `e57619e`)

- **Discrepàncies detectades:**
  1. *(Corregida a `20e0c82`)* En fitxes antigues amb `hitDiceUsed > 0` i `hitDiceUsedByDie === null`, `buildShortRestPatch()` permetia gastar daus indicant una mida explícita contra la reserva global, amb el risc de donar per disponible un dau ja gastat.
  2. *(Corregida a `e57619e`)* A `buildLongRestPatch()`, la branca de fitxes antigues (`hitDiceUsedByDie === null`) restablia directament tots els daus gastats a `0` i `{}` en un sol descans llarg, contravenint la regla oficial de D&D 5e (2014) PHB p. 186 (recuperar com a màxim la meitat dels daus totals arrodonida cap avall, mínim `1`).
  3. *(Corregida ara sobre `e57619e`)* A `buildLongRestPatch()`, la comprovació que rebutjava `hitDiceToRecover` amb `hitDiceUsedByDie === null` estava situada dins `if (spentDice > 0)`. Quan una fitxa tenia `hitDiceUsedByDie === null` i `hitDiceUsed === 0`, una petició amb `{ d10: 1 }` o `{ d10: 0 }` passava silenciosament sense retornar `UNALLOCATED_LEGACY_HIT_DICE`.
- **Nova lògica implementada:**
  - A `buildShortRestPatch()` ([rests.ts](src/domain/systems/dnd5e-2014/rests.ts)), si es demana gastar daus (`count > 0`) amb `hitDicePool.hasUnallocatedLegacyUsage === true` (`hitDiceUsedByDie === null && hitDiceUsed > 0`), es bloqueja amb `badRequest('UNALLOCATED_LEGACY_HIT_DICE', ...)` sense modificar PV ni cap altre valor, i sense permetre esquivar-ho indicant `d6`/`d8`/`d10`/`d12`.
  - A `buildLongRestPatch()` ([rests.ts](src/domain/systems/dnd5e-2014/rests.ts)), s’ha mogut la validació de `options?.hitDiceToRecover` abans de `if (spentDice > 0)` (sense duplicar-la a les branques internes): sempre que `sheet.hitPoints.hitDiceUsedByDie === null` i `hitDiceToRecover` contingui almenys una propietat amb valor diferent d’`undefined` (tant amb `hitDiceUsed === 0` com `hitDiceUsed > 0`, inclòs `{ d10: 0 }`), es rebutja amb `badRequest('UNALLOCATED_LEGACY_HIT_DICE', ...)`. En canvi, `{}` i propietats amb valor `undefined` (o ometre `hitDiceToRecover`) continuen essent vàlids i inicialitzen `hitDiceUsedByDie` a `{}` quan `hitDiceUsed === 0`.
  - Dins `if (spentDice > 0)`, la branca `hitDiceUsedByDie === null` calcula `allowance = Math.max(1, Math.floor(totalLevel / 2))`, `recovered = Math.min(spentDice, allowance)` i `remainingSpent = spentDice - recovered`:
    - **Recuperació parcial (`remainingSpent > 0`):** desa `hitDiceUsed = remainingSpent` i `hitDiceUsedByDie = null` (no inventa ni infereix cap distribució); el següent descans curt continua bloquejat amb `UNALLOCATED_LEGACY_HIT_DICE`.
    - **Recuperació total (`remainingSpent === 0`):** desa `hitDiceUsed = 0` i `hitDiceUsedByDie = {}`; el personatge ja pot tornar a gastar daus per mida als descansos curts posteriors.
    - **Permisos i comportament amb distribució coneguda:** respecta `hitPoints.hitDiceUsed` i `hitPoints.hitDiceUsedByDie` (`skippedByPermissions`) i no altera la recuperació normal (automàtica o explícita per mida) quan `hitDiceUsedByDie !== null`.
- **Exemples verificats (fitxes antigues sense assignació):**
  - **Nivell 5 (`allowance = 2`), 3 gastats:** recupera `2` → `hitDiceUsed = 1`, `hitDiceUsedByDie = null` (recuperació parcial; el descans curt continua bloquejat fins a un segon descans llarg que el porti a `0` i `{}`).
  - **Nivell 5 (`allowance = 2`), 2 gastats:** recupera `2` → `hitDiceUsed = 0`, `hitDiceUsedByDie = {}`.
  - **Nivell 5 (`allowance = 2`), 1 gastat:** recupera `1` → `hitDiceUsed = 0`, `hitDiceUsedByDie = {}`.
  - **Nivell 10 (`allowance = 5`), 7 gastats:** recupera `5` → `hitDiceUsed = 2`, `hitDiceUsedByDie = null`.
  - **`hitDiceUsed = 0` i `hitDiceUsedByDie = null`:** `{ d10: 1 }` i `{ d10: 0 }` retornen `UNALLOCATED_LEGACY_HIT_DICE`; `{}` , `{ d10: undefined }` i sense opcions completen el descans llarg i inicialitzen `hitDiceUsedByDie = {}`.
- **Fitxers modificats en aquesta correcció puntual:** `src/domain/systems/dnd5e-2014/rests.ts`, `tests/phase3b-domain-extensions.test.ts` i `PHASE_3B_CORRECTIONS.md`.
- **Confirmació d’abast:** no s’ha modificat cap component React, estil CSS, ruta visual, `schema.ts` ni migració SQL, no s’ha iniciat l’Increment 3C i no s’ha fet `git push`.

### 3.3 Overrides de màgia per classe (`spellcasting.sourceOverrides`)

- **Decisió:** ampliar `sheet.spellcasting` amb `sourceOverrides: Record<string, { abilityOverride?, saveDcOverride?, attackBonusOverride? }>` mantenint intactes `abilityOverride`, `saveDcOverride` i `attackBonusOverride` globals.
- **Justificació:** en personatges multiclasse (com Clergue / Mag), un objecte màgic o decisió de taula del GM pot alterar la CD o l’aptitud màgica d’una sola font sense contaminar la resta de classes llançadores ni trencar els atacs vinculats (`kind: 'spell'`, `spellSourceClassId`). Els camps globals continuen actuant com a fallback retrocompatible quan una classe no té entrada específica dins `sourceOverrides`.

### 3.4 Validacions i permisos ampliats (`permissions.ts`, `validation.ts`)

Nous camins incorporats a `PROTECTED_OFFICIAL_CALCULATION_PATHS` (bloquejats als jugadors tant en `POST` creació com en `PATCH` amb `403 OFFICIAL_CALCULATION_PROTECTED`, llevat d’autorització explícita del GM):
- `attacks.ability`
- `attacks.proficient`
- `attacks.gmCustom`
- `spellcasting.sourceOverrides`

---

## 4. Proves executades i resultats exactes

Totes les ordres s’han executat després de completar totes les modificacions de codi i proves (`rests.ts` i `tests/phase3b-domain-extensions.test.ts`):

- **`npm.cmd run typecheck`** (`tsc --noEmit`): **Superat (codi de sortida 0)** — `0` errors.
- **`npm.cmd test`** (`vitest run`): **Superat (codi de sortida 0)** — **10 fitxers de prova superats (10)**, **38 proves superades (38)**, `0` errors, `0` omeses, durada `55.24s`:
  - `tests/dnd5e-2014-virtual-dice-config.test.ts` (2 tests) — `27267ms`
  - `tests/campaigns-and-isolation.test.ts` (2 tests) — `27697ms`
  - `tests/player-invitations-and-permissions.test.ts` (2 tests) — `27410ms`
  - `tests/phase2-campaign-rules-and-limits.test.ts` (2 tests) — `27976ms`
  - `tests/phase2-identity-linking.test.ts` (2 tests) — `29670ms`
  - `tests/dnd5e-2014-rules-engine.test.ts` (7 tests) — `99ms`
  - `tests/auth-and-admin.test.ts` (3 tests) — `34031ms`
  - `tests/phase3-character-persistence-and-permissions.test.ts` (4 tests) — `41032ms`
  - `tests/db-production-guard.test.ts` (6 tests) — `11779ms`
  - `tests/phase3b-domain-extensions.test.ts` (8 tests) — `18030ms`
    - Inclou tots els casos de recuperació oficial i validació en fitxes antigues: nivell 5 amb `3`/`2`/`1` daus gastats, nivell 10 amb `7` daus gastats, persistència del descans llarg parcial (`hitDiceUsed = 1, hitDiceUsedByDie = null`) mantenint el bloqueig `UNALLOCATED_LEGACY_HIT_DICE` per a `d6`/`d8`/`d10`/`d12`, segon descans llarg fins a `0` i `{}`, despesa posterior per mida al descans curt, recuperació explícita amb distribució coneguda (`{ d10: 2, d6: 1 }`), rebuig de `hitDiceToRecover` (`{ d10: 1 }` i `{ d10: 0 }`) amb `hitDiceUsedByDie === null` tant si `hitDiceUsed === 0` com si `hitDiceUsed > 0`, validesa de `{}` / `{ d10: undefined }` / sense opcions amb `hitDiceUsed === 0`, i respecte de permisos sobre `hitPoints.hitDiceUsed` i `hitPoints.hitDiceUsedByDie`.
- **`npm.cmd run build`** (`next build`, Next.js 16.4.6 Turbopack): **Superat (codi de sortida 0)** — compilació en `2.7s`, TypeScript en `7.9s`, `3/3` pàgines estàtiques generades en `321ms`.

---

## 5. Limitacions que encara queden

1. **Entrades antigues sense `kind` previ a la revisió:** en normalitzar fitxes antigues sense camp `kind`, una entrada amb `inventoryItemId !== null` es classifica com `weapon_override`, una amb nom estàndard de cop desarmat com `unarmed`, i la resta com `special`. Qualsevol atac màgic preexistent sense `kind: 'spell'` requerirà indicar `kind: 'spell'` en editar-lo per obtenir el càlcul oficial de conjuració.
2. **Fitxes antigues multiclasse mixtes amb daus pendents (`hitDiceUsedByDie: null` i `hitDiceUsed > 0`):** per protecció conservadora, mentre conservin daus gastats antics sense assignació per mida no poden gastar daus de cop durant un descans curt (`400 UNALLOCATED_LEGACY_HIT_DICE`) ni recuperar mides individuals explícites (`hitDiceToRecover`), fins que completin tants descansos llargs oficials (`max(1, floor(totalLevel / 2))` per descans) com calguin per deixar `hitDiceUsed: 0` i inicialitzar `hitDiceUsedByDie: {}`.
3. **Classes `custom` sense dau oficial definit al catàleg:** si un personatge combina una classe `custom` amb `hitDiceUsed > 0`, `inferHitDiceUsedByDieFromClasses()` retorna `null` per prudència i la validació de capacitat per mida només s’aplica quan totes les classes pertanyen al catàleg oficial (o es gestiona mitjançant `hitDiceUsedByDie` explícit).
4. **Endpoints HTTP i interfície de l’Increment 3C:** la UI de les 5 pestanyes i els eventuals endpoints dedicats de descans/tirada virtual continuen pendents de l’Increment 3C.
