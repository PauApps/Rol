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
  - `buildShortRestPatch()` valida cada mida de dau sol·licitada contra `byDie[dieSize].available` (`400 INSUFFICIENT_HIT_DICE_FOR_SIZE`) quan el seguiment per mida és actiu, o contra `byDie[dieSize].total` i el disponible global en fitxes antigues sense inventar `hitDiceUsedByDie`.
  - `buildLongRestPatch()` recupera fins a `Math.max(1, Math.floor(totalLevel / 2))` daus. Quan hi ha desglossament per mida, admet selecció explícita (`hitDiceToRecover`) validant contra els daus gastats de cada mida (`400 INVALID_HIT_DICE_RECOVERY`), o recupera per defecte de mida més gran a més petita (`d12 → d10 → d8 → d6`). En fitxes antigues amb `hitDiceUsedByDie === null`, recupera globalment i gradua automàticament `hitDiceUsedByDie` a `{}` en arribar a `0`.

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

Totes les ordres s’han executat després de completar tots els canvis de codi, proves i documentació de repositori:

- **`npm.cmd run typecheck`** (`tsc --noEmit`): **Superat (codi de sortida 0)** — `0` errors.
- **`npm.cmd test`** (`vitest run`): **Superat (codi de sortida 0)** — **10 fitxers de prova superats (10)**, **38 proves superades (38)**, `0` errors, `0` omeses, durada `45.96s`:
  - `tests/player-invitations-and-permissions.test.ts` (2 tests) — `21889ms`
  - `tests/dnd5e-2014-virtual-dice-config.test.ts` (2 tests) — `22375ms`
  - `tests/campaigns-and-isolation.test.ts` (2 tests) — `22912ms`
  - `tests/phase2-campaign-rules-and-limits.test.ts` (2 tests) — `23116ms`
  - `tests/dnd5e-2014-rules-engine.test.ts` (7 tests) — `65ms`
  - `tests/phase2-identity-linking.test.ts` (2 tests) — `23671ms`
  - `tests/auth-and-admin.test.ts` (3 tests) — `26656ms`
  - `tests/phase3-character-persistence-and-permissions.test.ts` (4 tests) — `29759ms`
  - `tests/db-production-guard.test.ts` (6 tests) — `6721ms`
  - `tests/phase3b-domain-extensions.test.ts` (8 tests) — `13797ms`
- **`npm.cmd run build`** (`next build`, Next.js 16.4.6 Turbopack): **Superat (codi de sortida 0)** — compilació en `2.6s`, TypeScript en `9.1s`, `3/3` pàgines estàtiques generades en `199ms`.

---

## 5. Limitacions que encara queden

1. **Entrades antigues sense `kind` previ a la revisió:** en normalitzar fitxes antigues sense camp `kind`, una entrada amb `inventoryItemId !== null` es classifica com `weapon_override`, una amb nom estàndard de cop desarmat com `unarmed`, i la resta com `special`. Qualsevol atac màgic preexistent sense `kind: 'spell'` requerirà indicar `kind: 'spell'` en editar-lo per obtenir el càlcul oficial de conjuració.
2. **Fitxes antigues multiclasse mixtes amb daus pendents (`hitDiceUsedByDie: null`):** mentre conservin daus gastats anteriors (`hitDiceUsed > 0`), el descans curt incrementa el comptador global sense inventar mides i el descans llarg rebutja `hitDiceToRecover` granular (`400 UNALLOCATED_LEGACY_HIT_DICE`) fins que un descans llarg deixi `hitDiceUsed === 0` i activi el seguiment net per mida (`{}`).
3. **Classes `custom` sense dau oficial definit al catàleg:** si un personatge combina una classe `custom` amb `hitDiceUsed > 0`, `inferHitDiceUsedByDieFromClasses()` retorna `null` per prudència i la validació de capacitat per mida només s’aplica quan totes les classes pertanyen al catàleg oficial (o es gestiona mitjançant `hitDiceUsedByDie` explícit).
4. **Endpoints HTTP i interfície de l’Increment 3C:** la UI de les 5 pestanyes i els eventuals endpoints dedicats de descans/tirada virtual continuen pendents de l’Increment 3C.
