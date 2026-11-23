# Fase 3 — Increment 3B: Extensió del model de dades i motor de domini D&D 5e (2014)

**Data:** 2026-11-23  
**Branca base:** `main` (sobre `78f9da7`)  
**Àmbit:** Domini pur `src/domain/systems/dnd5e-2014/*`, servei `character-service.ts`, proves i documentació (sense UI React, CSS, rutes visuals ni migracions SQL).

---

## 1. Resum dels canvis

L’Increment 3B deixa completat el model de dades universal `v2` i el motor de regles D&D 5e (2014) per donar suport directe a la futura fitxa de 5 pestanyes de l’Increment 3C, sense duplicar càlculs a la interfície:

- **Retrocompatibilitat v1/v2 i ampliació JSONB:** tots els nous camps s’han incorporat dins `characters.sheet_data` amb valors per defecte segurs a Zod i normalització automàtica a `normalizeDnd5e2014Sheet()`.
- **Motor d’atacs (`attacks.ts`):** les armes equipades de l’inventari (`category === 'weapon' && equipped === true`) generen automàticament els atacs calculats sense duplicar objectes físics; les armes desequipades s’exclouen i `attacks[]` queda reservat per a atacs manuals o overrides enllaçats per `inventoryItemId`.
- **Motor de màgia multiclasse (`rules.ts` + `catalog.ts`):** suporta models independents per classe (`prepared`, `known`, `spellbook`, `pact`, `none`), càlcul de `preparedLimit` oficial i límit al servidor per a jugadors (`SPELL_PREPARED_LIMIT_EXCEEDED`), separació estricte entre grimori/coneguts/preparats/`alwaysPrepared` i Màgia de Pacte independent.
- **Descansos purs (`rests.ts`):** nous helpers `buildShortRestPatch()` i `buildLongRestPatch()` que retornen `Dnd5e2014SheetPatchInput` vàlids respectant daus de cop voluntaris, Màgia de Pacte, recuperació de recursos (`short_rest`, `long_rest`, `dawn` opt-in, exclusió de `other`) i permisos granulars del personatge.
- **Progressió i fites fins al nivell 20 (`rules.ts` + `catalog.ts`):** `computeProgression()` calcula `classProgressions` i `upcomingMilestones` per classe i personatge fins al nivell màxim oficial (20), amb `maxLevelMessageCa` en assolir el nivell 20 i sense extrapolar mai per damunt.
- **Recursos especials (`resources.ts`):** revisades les 12 classes oficials i subclasses suportades amb distinció explícita `origin: 'official' | 'custom'` i `sourceClassId`, incloent-hi Druida del Cercle de la Terra (`Recuperació natural`), Cercle de les Estrelles (`Forma estel·lar`, `Mapa estel·lar`, `Presagi còsmic` amb `proficiencyBonus`) i Mag d’Endevinació (`Presagi`).
- **Avantatge, normal i desavantatge (`schema.ts`, `rules.ts`, `dice.ts`):** suport de `rollModes` per habilitat i salvació sense alterar modificadors ni competències, i nou helper `executeVirtualD20Check()` subordinat exclusivament a `campaign.virtualDiceEnabled` (`403 VIRTUAL_DICE_DISABLED`).

---

## 2. Fitxers nous i modificats

### Fitxers nous
- `src/domain/systems/dnd5e-2014/attacks.ts`
- `src/domain/systems/dnd5e-2014/rests.ts`
- `tests/phase3b-domain-extensions.test.ts`
- `PHASE_3B_DOMAIN_IMPLEMENTATION.md`

### Fitxers modificats
- `src/domain/systems/dnd5e-2014/catalog.ts`
- `src/domain/systems/dnd5e-2014/schema.ts`
- `src/domain/systems/dnd5e-2014/rules.ts`
- `src/domain/systems/dnd5e-2014/resources.ts`
- `src/domain/systems/dnd5e-2014/dice.ts`
- `src/domain/systems/dnd5e-2014/validation.ts`
- `src/domain/systems/dnd5e-2014/permissions.ts`
- `src/domain/systems/dnd5e-2014/index.ts`
- `src/server/services/character-service.ts`
- `tests/dnd5e-2014-rules-engine.test.ts`
- `DATABASE.md`
- `SECURITY.md`
- `ROADMAP.md`
- `CHANGELOG.md`

*Nota:* No s’ha modificat cap component React, estil CSS, pàgina/ruta visual, `CampaignDetailClient.tsx`, migració SQL ni `docs/references/Fitxa_Interactiva_Pim_Bramble-v5.html`.

---

## 3. Nous camps i compatibilitat

Totes les ampliacions s’integren dins `Dnd5e2014SheetData` mantenint `schema_version = 2` i compatibilitat completa amb entrades `v1` i `v2` anteriors via `normalizeDnd5e2014Sheet()` i `.default(...)` als esquemes Zod:

- **`generalInfo`:**
  - `size: string | null` (defecte `null`)
  - `senses: string | null` (defecte `null`)
- **`savingThrows` i `skills`:**
  - `rollModes: Partial<Record<AbilityKey, RollMode>>` (defecte `{}`)
  - `rollModes: Partial<Record<SkillId, RollMode>>` (defecte `{}`)
- **`inventory` (`Dnd5e2014InventoryItem`):**
  - Categoria ampliada `InventoryCategory` amb `'magic_item'`
  - `requiresAttunement: boolean` (defecte `false`)
  - `attuned: boolean` (defecte `false`; forçat a `false` si `!requiresAttunement` durant la normalització i rebutjat per Zod si incoherència explícita)
  - `weaponAbility: AbilityKey | null` (defecte `null`)
  - `weaponProficient: boolean` (defecte `false`; reservat exclusivament a excepció controlada pel GM)
  - `damage: string | null` (defecte `null`)
  - `damageType: string | null` (defecte `null`)
  - `weaponRange: string | null` (defecte `null`)
  - `weaponProperties: string` (defecte `''`)
- **`attunement`:**
  - `attunement.limitOverride: number | null` (defecte `null`; quan és `null`, aplica `DEFAULT_ATTUNEMENT_LIMIT_2014 = 3`)
- **`attacks` (`Dnd5e2014AttackEntry`):**
  - `inventoryItemId: string | null` (defecte `null`; permet enllaçar notes o `bonusOverride` del GM sobre una arma de l’inventari sense duplicar-la)
  - `range: string | null` (defecte `null`)
- **`spells` (`Dnd5e2014SpellEntry`):**
  - `castingTime: string` (defecte `''`)
  - `range: string` (defecte `''`)
  - `components: string` (defecte `''`)
  - `duration: string` (defecte `''`)
  - `school: string | null` (defecte `null`)
  - `sourceType: SpellSourceType` (`'class' | 'pact' | 'feature' | 'race' | 'item' | 'custom'`, defecte `'class'`)
  - `sourceClassId: string | null` (defecte `null`)
  - `alwaysPrepared: boolean` (defecte `false`)
- **`progression`:**
  - `levelHistory: Dnd5e2014LevelHistoryEntry[]` (`id`, `level`, `classId`, `customClassName`, `subclassId`, `hpGain`, `notes`, `date`), ordenat per `level` a `normalizeDnd5e2014Sheet()` i `mergeDnd5e2014SheetPatch()`.

---

## 4. Càlculs implementats

- **Snapshot `ComputedDnd5e2014Snapshot` (`rules.ts`):**
  - `savingThrows` i `skills` inclouen `rollMode` (`'advantage' | 'normal' | 'disadvantage'`) sense modificar `abilityMod`, `proficiencyApplied` ni `total`.
  - `combat.totalHitDice` (`= totalLevel`) i `combat.availableHitDice` (`= Math.max(0, totalLevel - Math.max(0, hitPoints.hitDiceUsed))`).
  - `combat.attacks` calculat via `computeAttacks(sheet, abilityMods, proficiencyBonus)`.
  - `inventorySummary.attunement` amb `attunedCount`, `maxSlots`, `availableSlots`, `isOverridden`, `attunedItemIds` i `attunedItemNames`.
- **Progressió i fites (`computeProgression()`):**
  - Manté el límit oficial màxim `MAX_OFFICIAL_LEVEL_2014 = 20` i `isMaxLevel` / `maxLevelMessageCa` quan s’arriba al nivell 20.
  - Genera `classProgressions` amb `hitDie`, `averageHpPerLevel` (`getHitDieAverageGain(hitDie)` = `hitDie / 2 + 1`), `subclassUnlocked`, `unlockedAsiLevels` i `nextAsiLevel` dins el marge de nivells restants fins a 20.
  - Genera `upcomingMilestones` ordenades per `levelsRemaining` incloent-hi salts de bonificació de competència als nivells totals `5`, `9`, `13`, `17`, desbloqueig de subclasse, propers ASI, cercles de conjur desbloquejats i `keyFeatureMilestones` oficials de `catalog.ts`, sempre acotats amb `targetTotalLevel <= 20`.
- **Recursos (`computeCharacterResources()`):**
  - Classifica cada recurs amb `origin: 'official' | 'custom'` i `sourceClassId`.
  - Cobreix les 12 classes (`barbarian`, `bard`, `cleric`, `druid`, `fighter`, `monk`, `paladin`, `ranger`, `rogue`, `sorcerer`, `warlock`, `wizard`) i subclasses (`battle-master`, `circle-of-the-land`, `circle-of-stars`, `divination`), garantint que només apareixen els recursos aplicables a les classes/subclasses i nivells del personatge.
  - En el Druida del Cercle de les Estrelles, tant `Mapa estel·lar` com `Presagi còsmic` (des de nivell 6) escalen amb `proficiencyBonus` (calculat sobre el nivell total fins a 20).
- **Tirada virtual (`dice.ts`):**
  - `executeVirtualD20Check()` bloqueja qualsevol tirada si `!virtualDiceEnabled` amb error `403 VIRTUAL_DICE_DISABLED`, delega la combinació amb avantatge/desavantatge i cancel·lació mútua a `resolveRollMode()` i manté `isCriticalHit` / `isCriticalMiss` només per a `checkType === 'attack'`.

---

## 5. Regles de màgia i multiclasse

Implementat a `catalog.ts` (`resolveEffectiveClassSpellcasting`, `getSpellcastingUnlockLevel`) i `rules.ts` (`computeSpellcasting`):

- **Model per classe/subclasse:** `sources: ComputedSpellcastingSource[]` identifica individualment per a cada classe amb màgia activa: `model` (`'prepared' | 'known' | 'spellbook' | 'pact' | 'none'`), `progression`, `ability`, `saveDc`, `attackBonus`, `usesSpellbook`, `maxClassSpellLevel`, `preparedLimit`, `preparedCount`, `alwaysPreparedCount`, `spellbookCount`, `knownCount` i `exceedsPreparedLimit`.
- **Desbloqueig oficial:** classes `full` i `pact` a nivell 1; `half` (`paladin`, `ranger`) a nivell 2; `third` (`eldritch-knight`, `arcane-trickster`) a nivell 3.
- **Límits de conjurs preparats (`calculateClassPreparedLimit()`):**
  - Clergue, Druida i Mag: `Math.max(1, abilityMod + classLevel)`.
  - Paladí (a partir del nivell 2): `Math.max(1, abilityMod + Math.floor(classLevel / 2))`.
  - Bard, Explorador, Bruixot Innat, Bruixot de Pacte, Cavaller Arcà i Murri Arcà retornen `preparedLimit: null` (`known` o `pact`).
- **Separació grimori vs. preparats vs. especials:**
  - Els trucs (`level === 0`) i els conjurs `alwaysPrepared: true` (dominis, cercles, juraments) o amb `sourceType` `'feature' | 'race' | 'item' | 'custom'` **no** consumeixen el límit de preparats de classe (`alwaysPreparedCount` i `specialSpellsCount` es compten per separat; `spellbookCount` compta els conjurs al grimori independentment de si estan preparats).
- **Espais multiclasse i Pacte (D&D 5e 2014 PHB p. 164–165):**
  - Classe única `half`: `Math.ceil(level / 2)`. Classe única `third`: `Math.floor((level + 2) / 3)`.
  - Multiclasse (2+ classes llançadores no-Pacte): suma `full + Math.floor(half / 2) + Math.floor(third / 3)`.
  - La Màgia de Pacte del Bruixot (`warlock`) es calcula sempre separadament dins `pactMagic` i no suma al `effectiveCasterLevel` dels espais regulars.

---

## 6. Comportament dels descansos

Implementat com a funcions pures a `src/domain/systems/dnd5e-2014/rests.ts` que retornen `{ patch: Dnd5e2014SheetPatchInput, summary }`:

- **`buildShortRestPatch(sheet, options)`:**
  - No gasta daus de cop automàticament (`hitDiceSpent === 0` si no s’especifica `hitDiceToSpend`).
  - Quan el jugador tria `hitDiceToSpend`, valida que la mida (`d6|d8|d10|d12`) pertany a les classes del personatge i no supera ni la reserva de la classe ni `availableHitDice`, calcula `Math.max(0, rolled + conMod)` per dau (errata PHB 2014) i limita la curació a `hitPoints.max`.
  - Reinicia els espais de Màgia de Pacte (`spellSlotsUsed.pact = 0`) sense tocar els espais regulars `1..9`.
  - Reinicia només els recursos amb `recovery === 'short_rest'`; mai toca `long_rest`, `dawn` ni `other`.
- **`buildLongRestPatch(sheet, options)`:**
  - Restaura `hitPoints.current` fins a `hitPoints.max`, posa `hitPoints.temporary = 0` i reinicia `deathSaves` a `{ successes: 0, failures: 0 }`.
  - Recupera `Math.max(1, Math.floor(totalLevel / 2))` daus de cop gastats, sense baixar `hitDiceUsed` de `0`.
  - Reinicia tots els espais de conjur gastats (`1..9` i `pact`) a `0`.
  - Reinicia recursos amb `recovery === 'short_rest'` i `'long_rest'`. Els recursos `'dawn'` només es reinicien quan `options.includeDawnResources === true`, i els recursos manuals `'other'` no es reinicien mai automàticament (`skippedDawnResourceKeys` / `skippedManualCustomResourceKeys`).
- **Permisos:** tots dos helpers consulten `evaluatePlayerFieldAccess()` quan `isGm !== true` i afegeixen qualsevol camí restringit a `summary.skippedByPermissions` sense incloure’l al `patch`.

---

## 7. Càlculs d’atac i relació inventari → atacs

Implementat a `src/domain/systems/dnd5e-2014/attacks.ts` amb catàleg d’armes a `catalog.ts` (`DND5E_CORE_WEAPONS` + `lookupCoreWeapon()`):

- **Font única física:** qualsevol element de `sheet.inventory` amb `category === 'weapon' && equipped === true` genera una entrada `ComputedAttack` (`source: 'equipped_weapon'`). Si `equipped === false`, queda completament exclòs dels atacs actius.
- **Sense duplicació:** si existeix un registre dins `sheet.attacks` amb `inventoryItemId === item.id`, `computeAttacks()` el fusiona sobre l’atac generat per l’arma equipada (heretant notes i eventual `bonusOverride` del GM) i omet aquesta entrada en el bucle d’atacs manuals (`inventoryItemId !== null` no es renderitza mai per duplicat). Zod també rebutja `inventoryItemId` duplicats o apuntant a objectes inexistents/no-arma.
- **Característica legal d’atac (`getAllowedOfficialWeaponAbilities()`):**
  - Cos a cos estàndard: `['str']`.
  - Arma a distància: `['dex']`.
  - Arma amb propietat *Finesse / Sutil* o arma elegible d’Arts Marcials per a personatges amb classe `monk` (espasa curta o simple cos a cos sense *pesada* ni *a dues mans*): `['str', 'dex']`, escollint automàticament el modificador més alt si no s’ha indicat elecció.
  - Qualsevol característica fora d’`allowedOfficialAbilities` marca `isAbilityOverridden = true` i queda bloquejada als jugadors per `permissions.ts`.
- **Competència (`resolveWeaponProficiency()`):** resol la competència comprovant `sheet.proficiencies.weapons` (per nom, àlies del catàleg o categoria *armes senzilles* / *marcials* / *totes*). Si no coincideix, només es concedeix competència quan `item.weaponProficient === true` (marcat exclusivament com a `proficiencySource: 'gm_exception'`).

---

## 8. Validacions i permisos

- **Nous camins oficials protegits (`PROTECTED_OFFICIAL_CALCULATION_PATHS` a `permissions.ts`):**
  - `inventory.weaponProficient`
  - `inventory.weaponAbilityOverride`
  - `attunement.limitOverride`
  Els jugadors no poden establir ni alterar aquestes excepcions (`403 OFFICIAL_CALCULATION_PROTECTED`), llevat que el GM els autoritzi explícitament camí a camí a `fieldPermissions.authorizedOverrideFields`.
- **Camps editables per defecte afegits:** `'generalInfo.size'` i `'generalInfo.senses'` dins `DEFAULT_PLAYER_EDITABLE_FIELDS`; `savingThrows.rollModes`, `skills.rollModes`, `attunement`, camps estàndard d’inventari/conjurs i `progression.levelHistory` segueixen l’accés de la seva secció corresponent.
- **Validacions Zod (`validation.ts`):**
  - `.strict()` mantingut a totes les estructures per rebutjar camps desconeguts o valors calculats enviats pel client.
  - Coherència de sintonització: impedeix `attuned: true` si `requiresAttunement === false` i impedeix superar `attunement.limitOverride ?? 3` objectes sintonitzats.
  - Coherència d’enllaç d’atacs: impedeix `inventoryItemId` repetits o referències a objectes que no siguin `category: 'weapon'`.
  - Coherència de `progression.levelHistory`: impedeix nivells duplicats, nivells superiors al nivell actual del personatge, classes que no figurin a `raceAndClass.classes`, més entrades d’una classe que el seu nivell actual i subclasses contradictòries.
- **Límit de conjurs preparats al servidor (`character-service.ts`):**
  - `assertPlayerPreparedSpellLimits(sheet, isGm)` s’executa en `createCharacterBase()` i `updateCharacterBase()` i rebutja (`400 SPELL_PREPARED_LIMIT_EXCEEDED`) si un jugador no-GM supera el `preparedLimit` oficial d’alguna classe preparadora/grimori. El GM conserva capacitat d’excepció.

---

## 9. Migracions necessàries o justificació de no haver-ne fet

**No cal cap migració SQL ni s’ha modificat el DDL de PostgreSQL / Neon.**

Justificació tècnica:
- Totes les dades del personatge es persisteixen dins les columnes existents de la taula `characters` (`schema_version`, `sheet_data` JSONB, `custom_fields`, `field_permissions`, `gm_notes`), ja establertes per les migracions `0000`, `0001_cooing_hiroim.sql` i `0002`.
- Totes les ampliacions de l’Increment 3B viuen dins `sheet_data` JSONB amb normalització automàtica retroactiva a `normalizeDnd5e2014Sheet()` i valors per defecte a Zod, de manera que les fitxes `v1` i `v2` anteriors es llegeixen, es calculen i s’actualitzen sense pèrdua de dades ni bloquejos de desplegament.

---

## 10. Tests executats i resultats exactes

Totes les comprovacions següents s’han executat després de completar totes les modificacions de codi, proves i documentació del repositori (`DATABASE.md`, `SECURITY.md`, `ROADMAP.md`, `CHANGELOG.md`):

- **`npm.cmd run typecheck`** (`tsc --noEmit`): **Superat (codi de sortida 0)** — sense errors.
- **`npm.cmd test`** (`vitest run`): **Superat (codi de sortida 0)** — **10 fitxers de prova superats (10)**, **35 proves superades (35)**, **0 errors**, **0 omeses**, durada total `60.15s`:
  - `tests/campaigns-and-isolation.test.ts` (2 tests) — `35584ms`
  - `tests/player-invitations-and-permissions.test.ts` (2 tests) — `36617ms`
  - `tests/dnd5e-2014-virtual-dice-config.test.ts` (2 tests) — `36596ms`
  - `tests/phase2-campaign-rules-and-limits.test.ts` (2 tests) — `36697ms`
  - `tests/phase2-identity-linking.test.ts` (2 tests) — `38242ms`
  - `tests/dnd5e-2014-rules-engine.test.ts` (7 tests) — `82ms`
  - `tests/auth-and-admin.test.ts` (3 tests) — `45521ms`
  - `tests/phase3b-domain-extensions.test.ts` (5 tests) — `8873ms`
  - `tests/phase3-character-persistence-and-permissions.test.ts` (4 tests) — `51094ms`
  - `tests/db-production-guard.test.ts` (6 tests) — `12102ms`
- **`npm.cmd run build`** (`next build`, Next.js 16.4.6 Turbopack): **Superat (codi de sortida 0)** — compilació en `4.4s`, TypeScript en `10.6s`, 3/3 pàgines estàtiques generades correctament sense avisos d’error.

---

## 11. Limitacions conegudes

1. **Comptador global de daus de cop gastats (`hitPoints.hitDiceUsed`):** l’esquema emmagatzema un únic enter amb el total de daus gastats, no una reserva separada per mida de dau (`d6`/`d8`/`d10`/`d12`). En personatges multiclasse amb daus de mida diferent, `buildShortRestPatch()` valida que no se superin els daus de cada classe ni el total disponible, però assumeix que el jugador selecciona quin dau gasta en cada descans curt fins que s’afegeixi un mapa opcional per mida si calgués.
2. **Absència d’una base de dades estàtica de textos de conjurs:** en coherència amb els drets de propietat intel·lectual, no s’han incrustat descripcions protegides ni llistes automàtiques completes de conjurs. Els conjurs de cercle/domini/jurament es registren amb `alwaysPrepared: true` (i no resten del límit oficial de preparats).
3. **Subclasses sense recurs numèric dedicat:** totes les 12 classes del catàleg tenen revisats els recursos oficials (en el cas de `ranger`, els trets del PHB 2014 són passius o usen espais de conjur, de manera que no genera recursos numèrics propis), mentre que subclasses sense recurs numèric predefinit usen `customResources` (`origin: 'custom'`).
4. **Endpoints HTTP per a descansos i tirada virtual:** `buildShortRestPatch()`, `buildLongRestPatch()` i `executeVirtualD20Check()` estan provats al domini i via `updateCharacterBase()`, però les rutes API o accions interactives pròpies de la UI queden reservades per a l’Increment 3C.

---

## 12. Decisions pendents abans de l’Increment 3C

1. **Rutes API dedicades vs. accions sobre `/api/campaigns/[id]/characters/[characterId]`:** confirmar si els descansos curts/llargs i la tirada virtual del client s’exposaran mitjançant endpoints dedicats (`/rest`, `/roll`) amb auditoria pròpia o com a operacions dins el recurs del personatge.
2. **Flux de pujada de nivell a la UI:** definir com presentar l’assistent de pujada de nivell utilitzant `upcomingMilestones`, `averageHpPerLevel` i `progression.levelHistory` mantenint sincronitzats els nivells de `raceAndClass.classes`.
3. **Control opcional de daus de cop per mida en multiclasse:** decidir si convé afegir un camp JSONB opcional (`hitDiceUsedByDie`) a l’Increment 3C o mantenir el comptador únic actual.
4. **Visibilitat per defecte de nous subcamps:** confirmar si algun camp nou específic (com `progression.levelHistory` o `savingThrows.rollModes`) ha de figurar per defecte amb restricció especial o seguir els permisos estàndard de la seva secció.
