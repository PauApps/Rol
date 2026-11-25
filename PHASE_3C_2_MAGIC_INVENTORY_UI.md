# Informe d'implementació — Fase 3, Increment 3C.2 (Pestanyes «Màgia i habilitats» i «Equipament i inventari»)

**Repositori:** `https://github.com/PauApps/Rol`  
**Branca base:** `main` (sobre `4372ac16abb428af64b1aa0378cfee1c8228606a`, amb el 3C.1 ja publicat)  
**Data:** 2026-11-25

---

## 1. Confirmació explícita d'abast i restriccions

- **Domini intacte:** No s'ha modificat cap fitxer dins `src/domain/systems/dnd5e-2014/**` (`schema.ts`, `catalog.ts`, `rules.ts`, `resources.ts`, `attacks.ts`, `permissions.ts`, `validation.ts`, `rests.ts`, `dice.ts`).
- **Serveis, API i BD intactes:** No s'ha modificat `src/server/services/character-service.ts`, cap ruta dins `src/app/api/**`, `src/db/**` ni `drizzle/**`.
- **Control d'increment:** No s'ha iniciat el 3C.3 («Història i diari» ni «Progressió i evolució») ni el 3C.4 (descansos, recuperació automàtica ni tirades virtuals), i no s'ha executat `git commit` ni `git push`.

---

## 2. Auditoria inicial sobre el codi real

En revisar l'estat local sobre `4372ac1` s'ha confirmat:

1. **Contractes del 3C.1 (`CharacterSheetClient`, `types.ts`, `sheet-patch.ts`, `sheet-permissions.ts`):** l'esborrany `CharacterSheetDraft` i `buildCharacterSheetPatch()` permeten ampliar camps sense perdre el seguiment de canvis entre pestanyes ni la protecció `inFlightRef`.
2. **Estructura de `computed.spellcasting` (`rules.ts`):** retorna `null` en personatges sense màgia ni conjurs ni overrides; quan és actiu, exposa `ability`, `abilityLabelCa`, `saveDc`, `attackBonus`, `usesSpellbook`, `effectiveCasterLevel`, `slots` (nivells 1–9 amb `total`, `used`, `available`), `pactMagic` separat (`count`, `slotLevel`, `used`, `available`), `sources[]` per classe (amb `model`, `preparedLimit`, `preparedCount`, `alwaysPreparedCount`, `spellbookCount`, `knownCount`, `exceedsPreparedLimit`) i comptadors globals.
3. **Estructura de `computed.resources` (`resources.ts`):** genera exclusivament els recursos oficials aplicables per classe/subclasse (Bàrbar, Bard, Clergue, Druida incloent Cercle de la Terra i Cercle de les Estrelles amb `usageKey` compartit per `Forma estel·lar`, Guerrer, Monjo, Paladí, Murri, Bruixot innat, Bruixot de pacte i Mag) i els `customResources`, exposant `key`, `usageKey`, `name`, `source`, `totalUses`, `unlimited`, `used`, `available`, `recovery` i `isCustom`.
4. **Restricció del servidor en conjurs preparats:** `character-service.ts` invoca `assertPlayerPreparedSpellLimits()` en `PATCH` quan s'edita `spells` com a jugador (`400 SPELL_PREPARED_LIMIT_EXCEEDED`).
5. **Inventari i càrrega (`rules.ts`, `attacks.ts`):** `inventorySummary` calcula `totalItemsCount`, `totalWeight`, `equippedArmorName`, `equippedShieldName` i `attunement` (`attunedCount`, `maxSlots`, `availableSlots`, `isOverridden`). El domini **no** calcula capacitat màxima de càrrega. Les armes equipades generen automàticament atacs a `computed.combat.attacks` sense duplicar cap llista.

---

## 3. Components creats i modificats

### Fitxers nous
- **Pestanya «Màgia i habilitats» (`src/components/characters/magic/`):**
  - `SpellcastingSummaryCard.tsx`: resum de conjuració, targetes diferenciades per classe en multiclasse, edició controlada de `spellcasting.usesSpellbook` i `spellcasting.notes`, i overrides globals/per classe només per a GM o camins autoritzats.
  - `SpellSlotsCard.tsx`: espais regulars (1r–9è cercle) i Màgia de Pacte diferenciada amb marcadors interactius de `spellSlotsUsed` i editor de `spellSlotOverrides` protegit.
  - `SpellsListCard.tsx`: llista agrupada per nivell (0–9) amb filtres, badges d'estat (`Sempre preparat`, `Preparat`, `Al grimori`, `Conegut`), concentració/ritual, indicadors de límit de preparació per classe, bloqueig client preventiu d'excés de preparats per a jugadors, bloqueig d'alteració de `alwaysPrepared` per a no-GM, creació/edició manual i eliminació amb confirmació.
  - `ResourcesCard.tsx`: renderització fidel de `computed.resources` sense recursos hardcodejats, control d'usos via `resourceUsage` (respectant reserves compartides via `usageKey`) i gestió de `customResources` només per a GM/autoritzats.
  - `TraitsCard.tsx`: visualització diferenciada de `traitsAndFeatures` per procedència i nivell amb creació, edició i eliminació confirmada.
  - `MagicAndAbilitiesTab.tsx`: contenidor accessible (`role="tabpanel" id="panel-magic"`) responsive.
- **Pestanya «Equipament i inventari» (`src/components/characters/inventory/`):**
  - `InventorySummaryBar.tsx`: pes total i unitats calculats pel servidor (amb avís explícit de capacitat de càrrega no calculada pel domini), CA i armadura/escut equipats des de `computed`, comptador/llista de sintonització (límit oficial 3 o `attunement.limitOverride` autoritzat) i avisos al límit.
  - `CurrencyCard.tsx`: les cinc monedes (`cp`, `sp`, `ep`, `gp`, `pp`) sense conversions automàtiques.
  - `InventoryItemsCard.tsx`: inventari agrupat i filtrable per les 7 categories oficials (`weapon`, `armor`, `shield`, `gear`, `magic_item`, `treasure`, `custom`), quantitats, equipament, sintonització, propietats d'arma vinculades al catàleg oficial (`getAllowedOfficialWeaponAbilities`), overrides de GM protegits, camps d'armadura/escut i confirmació d'eliminació (neteja referències `weapon_override` òrfenes en eliminar una arma).
  - `InventoryTab.tsx`: contenidor accessible (`role="tabpanel" id="panel-inventory"`).
- **Proves i documentació:**
  - `tests/phase3c2-magic-inventory-ui.test.ts`
  - `PHASE_3C_2_MAGIC_INVENTORY_UI.md`

### Fitxers modificats
- `src/components/characters/types.ts`: activació de les pestanyes `magic` i `inventory`, ampliació de `CharacterSheetDraft` i diccionaris de visualització.
- `src/components/characters/sheet-patch.ts`: extensió de `createDraftFromCharacter()` i `buildCharacterSheetPatch()` per generar patches mínims i sanititzar camps protegits en tots els nous apartats.
- `src/components/characters/TabPlaceholder.tsx`: acotat exclusivament a `story` i `progression` (3C.3).
- `src/components/characters/CharacterSheetClient.tsx`: integració de `MagicAndAbilitiesTab` i `InventoryTab` mantenint la conservació d'esborrany entre totes les pestanyes.
- `tests/phase3c1-character-sheet-ui.test.ts`: actualitzada la prova de `TabPlaceholder` de `'magic'` a `'story'`.
- `ROADMAP.md`: actualitzat amb el tancament del 3C.2 i el detall pendent de 3C.3–3C.4.

---

## 4. Contractes, permisos i proteccions verificats

Tots els nous camins passen per `canEditSheetField()` a la UI i `buildCharacterSheetPatch()` abans del `PATCH /api/campaigns/[id]/characters/[characterId]`, amb validació definitiva al servidor:

- **Edició estàndard de jugador propietari (segons `editableFields`):** `spellcasting.usesSpellbook`, `spellcasting.notes`, `spells`, `spellSlotsUsed`, `resourceUsage`, `traitsAndFeatures`, `inventory`, `currency.*`.
- **Proteccions especials per a no-GM:**
  - `alwaysPrepared` en conjurs queda blocat (no es pot activar per esquivar el límit de preparats; si un jugador intenta enviar només un canvi de `alwaysPrepared`, `buildCharacterSheetPatch()` ni tan sols emet `spells`).
  - `inventory[].weaponAbility` queda limitat a `getAllowedOfficialWeaponAbilities()` tret que `inventory.weaponAbilityOverride` estigui autoritzat.
- **Camins protegits d'alt nivell (`PROTECTED_OFFICIAL_CALCULATION_PATHS`):** `spellcasting.abilityOverride`, `spellcasting.saveDcOverride`, `spellcasting.attackBonusOverride`, `spellcasting.sourceOverrides`, `spellSlotOverrides`, `customResources`, `attunement.limitOverride`, `inventory.weaponProficient` i `inventory.weaponAbilityOverride`.
- **Aïllament:** els jugadors no propietaris només consulten en lectura (`canEdit: false`, `403 CHARACTER_EDIT_FORBIDDEN` en intentar editar) i mai no reben `gmNotes` ni `fieldPermissions`.

---

## 5. Proves executades i resultats reals

Totes les comprovacions s'han executat després de l'última edició del codi i de les proves:

- **`npm.cmd run typecheck`** (`tsc --noEmit`): **Superat (codi de sortida 0)** — `0` errors.
- **`npm.cmd test`** (`vitest run`): **Superat (codi de sortida 0)** — **12 fitxers de prova superats (12)**, **44 proves superades (44)**, `0` errors, `0` omeses, durada `36.98s`:
  - `tests/phase3c2-magic-inventory-ui.test.ts` (3 tests) — `11691ms`:
    1. Renderitzat SSR: personatge sense màgia, multiclasse complex (Clergue + Bruixot de Pacte + Druida Estrelles amb reserva compartida), espais regulars i de Pacte, conjurs preparats/sempre preparats, recursos personalitzats, trets, inventari amb totes les categories rellevants, sintonització, CA del servidor i nota de capacitat de càrrega sense fórmules inventades.
    2. Permisos parcials i patches mínims: exclusió de `currency`, `spellSlotOverrides`, `attunement.limitOverride`, `weaponAbility` il·legal, `weaponProficient`, preservació de seccions intactes i protecció de `alwaysPrepared`.
    3. Integració real amb BD: lectura compartida sense `gmNotes`, rebuig `403 CHARACTER_EDIT_FORBIDDEN` per a altres jugadors, creació/edició de conjurs, espais, trets, 7 categories d'inventari, armes equipades → atacs automàtics sense duplicats, desequipament → desaparició de l'atac i recàlcul de CA, monedes, pes exacte, rebuig `400 SPELL_PREPARED_LIMIT_EXCEEDED` en excedir preparats i gestió completa de GM (`customResources`, `spellSlotOverrides`, `attunement.limitOverride`).
  - Resta de la suite (`11` fitxers previs, inclòs `tests/phase3c1-character-sheet-ui.test.ts`): tots superats sense regressions.
- **`npm.cmd run build`** (`next build`, Next.js 16.4.6 Turbopack): **Superat (codi de sortida 0)** — compilació en `2.5s`, TypeScript en `12.4s`, `3/3` pàgines estàtiques generades en `252ms`.

---

## 6. Limitacions detectades i pendent per a 3C.3 / 3C.4

- **Limitacions actuals del 3C.2:**
  - El domini encara no exposa una capacitat de càrrega màxima calculada dins `computed.inventorySummary`, de manera que la interfície mostra el pes total real (`totalWeight`) i ho deixa indicat explícitament sense inventar fórmules.
  - Si una mateixa arma física es vol ajustar amb un atac vinculat `weapon_override` personalitzat pel GM (`attacks[].bonusOverride`), aquesta capa avançada continua centralitzada al model d'atacs.
- **Pendent per a l'Increment 3C.3:** Pestanyes **«Història i diari»** i **«Progressió i evolució»** (`generalInfo` ampliat, rerefons, `sessionNotes`, classes/subclasses, XP, fites i `levelHistory`).
- **Pendent per a l'Increment 3C.4:** Endpoints i interfície per a descans curt i llarg (`rests.ts`), execució i historial de tirades de dau virtual (`dice.ts`), camps personalitzats i còpia selectiva de configuració entre campanyes.
