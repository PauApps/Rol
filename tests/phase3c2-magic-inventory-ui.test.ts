import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import {
  DEFAULT_PLAYER_EDITABLE_FIELDS,
  computeDnd5e2014Sheet,
  createEmptyDnd5e2014Sheet,
  normalizeDnd5e2014Sheet,
} from '@/domain/systems/dnd5e-2014';
import { resolveSession } from '@/server/auth/session';
import { createCampaign } from '@/server/services/campaign-service';
import {
  createCharacterBase,
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { InventoryTab } from '@/components/characters/inventory/InventoryTab';
import { MagicAndAbilitiesTab } from '@/components/characters/magic/MagicAndAbilitiesTab';
import { buildCharacterSheetPatch, createDraftFromCharacter } from '@/components/characters/sheet-patch';
import { buildSheetAccessContext, canEditSheetField } from '@/components/characters/sheet-permissions';
import {
  INVENTORY_CATEGORY_LABELS_CA,
  type CharacterSheetRecord,
} from '@/components/characters/types';
import { bootstrapAdmin, createInvitedGm } from './helpers';

function makeSheetRecord(
  name: string,
  mutator?: (sheet: ReturnType<typeof createEmptyDnd5e2014Sheet>) => void,
  recordOverrides?: Partial<CharacterSheetRecord>
): CharacterSheetRecord {
  const sheet = createEmptyDnd5e2014Sheet(name);
  mutator?.(sheet);
  const normalized = normalizeDnd5e2014Sheet(sheet, name);
  const computed = computeDnd5e2014Sheet(normalized);

  return {
    id: '00000000-0000-4000-8000-000000000031',
    campaignId: '00000000-0000-4000-8000-000000000001',
    memberId: '00000000-0000-4000-8000-000000000020',
    ownerDisplayName: 'Pau',
    systemId: 'dnd5e-2014',
    name,
    schemaVersion: 2,
    sheetData: normalized,
    computed,
    customFields: {},
    isMine: true,
    canEdit: true,
    editableFields: [...DEFAULT_PLAYER_EDITABLE_FIELDS],
    authorizedOverrideFields: [],
    createdAt: '2026-11-25T19:00:00.000Z',
    updatedAt: '2026-11-25T19:00:00.000Z',
    ...recordOverrides,
  };
}

describe('Fase 3 (Increment 3C.2): Pestanyes «Màgia i habilitats» i «Equipament i inventari»', () => {
  it('renderitza correctament sense màgia, amb una classe llançadora, amb multiclasse i Màgia de Pacte, recursos i inventari', () => {
    // 1. Personatge sense màgia (Guerrer)
    const fighter = makeSheetRecord('Tordek', (s) => {
      s.raceAndClass.classes = [{ classId: 'fighter', level: 5 }];
      s.abilities = { str: 16, dex: 12, con: 15, int: 10, wis: 10, cha: 10 };
    });
    const fighterAccess = buildSheetAccessContext(fighter, false);
    const nonCasterHtml = renderToStaticMarkup(
      React.createElement(MagicAndAbilitiesTab, {
        character: fighter,
        draft: createDraftFromCharacter(fighter),
        access: fighterAccess,
        onUpdateDraft: () => undefined,
      })
    );
    expect(nonCasterHtml).toContain('Sense màgia activa');
    expect(nonCasterHtml).toContain('Segon alè');
    expect(nonCasterHtml).toContain('Acció sobtada');

    // 2. Personatge multiclasse complex (Clergue 3 / Bruixot de Pacte 2 / Druida Estrelles 2)
    const multicaster = makeSheetRecord('Lyra', (s) => {
      s.raceAndClass.classes = [
        { classId: 'cleric', subclassId: 'life-domain', level: 3 },
        { classId: 'warlock', subclassId: 'archfey', level: 2 },
        { classId: 'druid', subclassId: 'circle-of-stars', level: 2 },
      ];
      s.abilities = { str: 10, dex: 14, con: 14, int: 10, wis: 18, cha: 16 };
      s.spellcasting.usesSpellbook = true;
      s.spellSlotsUsed = { '1': 1, pact: 1 };
      s.resourceUsage = { 'class:druid:wild_shape': 1 };
      s.customResources = [
        {
          id: 'cr-1',
          name: 'Benedicció lunar',
          maxUses: 2,
          recovery: 'dawn',
          description: 'Usos especials de campanya',
        },
      ];
      s.spells = [
        {
          id: 'sp-always',
          level: 1,
          name: 'Beneir',
          castingTime: '1 acció',
          range: '9 m',
          components: 'V, S, M',
          duration: '1 minut',
          school: 'Encantament',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: true,
          prepared: false,
          inSpellbook: false,
          ritual: false,
          concentration: true,
          notes: 'Domini de la Vida',
        },
        {
          id: 'sp-prep',
          level: 1,
          name: 'Curar ferides',
          castingTime: '1 acció',
          range: 'Toc',
          components: 'V, S',
          duration: 'Instantània',
          school: 'Evocació',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: false,
          prepared: true,
          inSpellbook: false,
          ritual: false,
          concentration: false,
          notes: '',
        },
        {
          id: 'sp-pact',
          level: 1,
          name: 'Maledicció (Hex)',
          castingTime: '1 acció addicional',
          range: '27 m',
          components: 'V, S, M',
          duration: '1 hora',
          school: 'Encantament',
          sourceType: 'pact',
          sourceClassId: 'warlock',
          alwaysPrepared: false,
          prepared: false,
          inSpellbook: false,
          ritual: false,
          concentration: true,
          notes: '',
        },
      ];
      s.traitsAndFeatures = [
        {
          id: 'tr-1',
          name: 'Visió feèrica',
          source: 'Raça',
          levelUnlocked: 1,
          description: 'Veu en la penombra.',
        },
      ];
      s.inventory = [
        {
          id: 'inv-wpn',
          name: 'Daga',
          category: 'weapon',
          quantity: 1,
          weight: 0.5,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: 'dex',
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: '1d4+2',
          damageType: 'perforant',
          weaponRange: '6/18 m',
          weaponProperties: 'Finesse, lleugera, llançament',
          notes: '',
        },
        {
          id: 'inv-arm',
          name: 'Cuir tatxonat',
          category: 'armor',
          quantity: 1,
          weight: 6,
          equipped: true,
          armorType: 'light',
          baseAc: 12,
          acBonus: 0,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'inv-sh',
          name: 'Escut de fusta',
          category: 'shield',
          quantity: 1,
          weight: 3,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: 2,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'inv-mag',
          name: 'Pedra d’Ioun',
          category: 'magic_item',
          quantity: 1,
          weight: 0.1,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: true,
          attuned: true,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
      ];
      s.currency = { cp: 15, sp: 20, ep: 2, gp: 85, pp: 1 };
    });

    const multiAccess = buildSheetAccessContext(multicaster, false);
    const magicHtml = renderToStaticMarkup(
      React.createElement(MagicAndAbilitiesTab, {
        character: multicaster,
        draft: createDraftFromCharacter(multicaster),
        access: multiAccess,
        onUpdateDraft: () => undefined,
      })
    );
    expect(magicHtml).toContain('Clergue 3');
    expect(magicHtml).toContain('Bruixot de pacte (Warlock) 2');
    expect(magicHtml).toContain('Màgia de Pacte');
    expect(magicHtml).toContain('Sempre preparat');
    expect(magicHtml).toContain('Beneir');
    expect(magicHtml).toContain('Curar ferides');
    expect(magicHtml).toContain('Canalitzar divinitat');
    expect(magicHtml).toContain('Forma salvatge');
    expect(magicHtml).toContain('Forma estel·lar');
    expect(magicHtml).toContain('Benedicció lunar');
    expect(magicHtml).toContain('Visió feèrica');

    const invHtml = renderToStaticMarkup(
      React.createElement(InventoryTab, {
        character: multicaster,
        draft: createDraftFromCharacter(multicaster),
        access: multiAccess,
        onUpdateDraft: () => undefined,
      })
    );
    expect(invHtml).toContain('Daga');
    expect(invHtml).toContain('Cuir tatxonat');
    expect(invHtml).toContain('Escut de fusta');
    expect(invHtml).toContain('Pedra d’Ioun');
    expect(invHtml).toContain('1 / 3 sintonitzats');
    expect(invHtml).toContain(`CA ${multicaster.computed.combat.armorClass.value}`);
    expect(invHtml).toContain('Capacitat màxima de càrrega no calculada pel domini actual');
    expect(invHtml).toContain(INVENTORY_CATEGORY_LABELS_CA.weapon);
    expect(invHtml).toContain(INVENTORY_CATEGORY_LABELS_CA.magic_item);
  });

  it('construeix patches mínims per a 3C.2 protegint sempre alwaysPrepared, overrides i camps no autoritzats', () => {
    const record = makeSheetRecord('Valen', (s) => {
      s.raceAndClass.classes = [{ classId: 'cleric', level: 2 }];
      s.abilities = { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 10 };
      s.spells = [
        {
          id: 'sp-1',
          level: 1,
          name: 'Escut de fe',
          castingTime: '1 acció addicional',
          range: '18 m',
          components: 'V, S, M',
          duration: '10 minuts',
          school: 'Abjuració',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: false,
          prepared: true,
          inSpellbook: false,
          ritual: false,
          concentration: true,
          notes: '',
        },
      ];
      s.inventory = [
        {
          id: 'wpn-mace',
          name: 'Maça',
          category: 'weapon',
          quantity: 1,
          weight: 2,
          equipped: false,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: '1d6',
          damageType: 'contudent',
          weaponRange: '1,5 m',
          weaponProperties: '',
          notes: '',
        },
      ];
    });

    // Jugador amb permisos parcials (sense currency ni customResources)
    const partialRecord: CharacterSheetRecord = {
      ...record,
      editableFields: ['spells', 'spellSlotsUsed', 'inventory'],
    };
    const partialAccess = buildSheetAccessContext(partialRecord, false);
    expect(canEditSheetField('currency.gp', partialAccess)).toBe(false);
    expect(canEditSheetField('customResources', partialAccess)).toBe(false);
    expect(canEditSheetField('attunement.limitOverride', partialAccess)).toBe(false);
    expect(canEditSheetField('spellSlotOverrides', partialAccess)).toBe(false);
    expect(canEditSheetField('spells', partialAccess)).toBe(true);
    expect(canEditSheetField('inventory', partialAccess)).toBe(true);

    const draft = createDraftFromCharacter(partialRecord);
    // Simulem canvis acumulats en múltiples pestanyes: espais, conjurs i inventari + intents protegits
    draft.spellSlotsUsed['1'] = 2;
    draft.spellSlotOverrides['1'] = 9; // bloquejat per jugador
    draft.attunement.limitOverride = 7; // bloquejat per jugador
    draft.currency.gp = 9999; // fora de permisos parcials
    draft.spells[0] = { ...draft.spells[0], alwaysPrepared: true }; // jugador no pot activar alwaysPrepared
    draft.inventory[0] = {
      ...draft.inventory[0],
      equipped: true,
      weaponAbility: 'cha', // il·legal en maça
      weaponProficient: true, // protegit
    };

    const built = buildCharacterSheetPatch(partialRecord, draft, partialAccess);
    expect(built.hasChanges).toBe(true);
    const sp = built.payload.sheetPatch as Record<string, unknown>;
    expect(sp.spellSlotsUsed).toEqual({ '1': 2 });
    expect(sp.spellSlotOverrides).toBeUndefined();
    expect(sp.attunement).toBeUndefined();
    expect(sp.currency).toBeUndefined();
    expect(sp.abilities).toBeUndefined();
    // Si l'únic canvi intentat és `alwaysPrepared`, no emet `spells`
    expect(sp.spells).toBeUndefined();

    // Si edita una propietat vàlida (`notes`) mantenint l'intent de `alwaysPrepared: true`, sempre el deixa a `false`
    draft.spells[0] = { ...draft.spells[0], notes: 'Afegir +2 CA' };
    const builtWithSpellNote = buildCharacterSheetPatch(partialRecord, draft, partialAccess);
    const spWithNote = builtWithSpellNote.payload.sheetPatch as Record<string, unknown>;
    const patchedSpell = (spWithNote.spells as Array<Record<string, unknown>>)[0];
    expect(patchedSpell.alwaysPrepared).toBe(false);
    expect(patchedSpell.notes).toBe('Afegir +2 CA');

    const patchedWeapon = (spWithNote.inventory as Array<Record<string, unknown>>)[0];
    expect(patchedWeapon.equipped).toBe(true);
    expect(patchedWeapon.weaponAbility).toBeNull();
    expect(patchedWeapon.weaponProficient).toBe(false);
  });

  it('valida en BD totes les operacions de Màgia, Inventari, atacs automàtics, límit de conjurs preparats, monedes i permisos', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.3c2@rol.test', 'GM 3C2');
      const camp = await createCampaign(db, gm.ctx, { name: 'Taula 3C2', systemId: 'dnd5e-2014' });

      const inv1 = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg1 = await acceptPlayerInvitation(db, inv1.rawToken, {
        mode: 'register',
        email: 'p1.3c2@rol.test',
        displayName: 'Jugador 3C2',
        password: 'PlayerPassword123!',
      });
      const p1Ctx = await resolveSession(db, reg1.rawToken);

      const inv2 = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg2 = await acceptPlayerInvitation(db, inv2.rawToken, {
        mode: 'register',
        email: 'p2.3c2@rol.test',
        displayName: 'Observador 3C2',
        password: 'PlayerPassword123!',
      });
      const p2Ctx = await resolveSession(db, reg2.rawToken);

      // Clergue nivell 1 amb SAV 12 (+1 mod) -> límit oficial de preparats = max(1, 1 + 1) = 2
      const cleric = await createCharacterBase(db, p1Ctx, camp.id, {
        name: 'Seren',
        sheetData: {
          raceAndClass: { classes: [{ classId: 'cleric', level: 1 }] },
          abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
          proficiencies: { armor: ['Armadures lleugeres', 'Escuts'], weapons: ['Armes senzilles'], tools: [], languages: [] },
        },
      });

      await updateCharacterBase(db, gm.ctx, camp.id, cleric.id, {
        gmNotes: 'Visió secreta del GM',
      });

      // Un altre jugador pot consultar la fitxa però mai veure gmNotes ni editar-la
      const otherView = await getCampaignCharacter(db, p2Ctx, camp.id, cleric.id);
      expect(otherView.canEdit).toBe(false);
      expect('gmNotes' in otherView).toBe(false);
      await expect(
        updateCharacterBase(db, p2Ctx, camp.id, cleric.id, {
          sheetPatch: { currency: { gp: 50 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_EDIT_FORBIDDEN' });

      // El propietari afegeix 2 conjurs preparats, gasta 1 espai, afegeix tret i objectes d'inventari (arma + armadura + escut + objecte màgic sintonitzat + monedes)
      const loaded1 = await getCampaignCharacter(db, p1Ctx, camp.id, cleric.id);
      const rec1: CharacterSheetRecord = {
        ...loaded1,
        sheetData: loaded1.sheetData as CharacterSheetRecord['sheetData'],
        createdAt: loaded1.createdAt.toISOString(),
        updatedAt: loaded1.updatedAt.toISOString(),
      };
      const access1 = buildSheetAccessContext(rec1, false);
      const draft1 = createDraftFromCharacter(rec1);

      draft1.spells = [
        {
          id: 'sp-1',
          level: 1,
          name: 'Curar ferides',
          castingTime: '1 acció',
          range: 'Toc',
          components: 'V, S',
          duration: 'Instantània',
          school: 'Evocació',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: false,
          prepared: true,
          inSpellbook: false,
          ritual: false,
          concentration: false,
          notes: '',
        },
        {
          id: 'sp-2',
          level: 1,
          name: 'Guiatge',
          castingTime: '1 acció',
          range: '36 m',
          components: 'V, S',
          duration: 'Instantània',
          school: 'Evocació',
          sourceType: 'class',
          sourceClassId: 'cleric',
          alwaysPrepared: false,
          prepared: true,
          inSpellbook: false,
          ritual: false,
          concentration: false,
          notes: '',
        },
      ];
      draft1.spellSlotsUsed = { '1': 1 };
      draft1.traitsAndFeatures = [
        {
          id: 'tr-1',
          name: 'Benvinguda sagrada',
          source: 'Classe',
          levelUnlocked: 1,
          description: 'Tret de clergue.',
        },
      ];
      draft1.inventory = [
        {
          id: 'wpn-mace',
          name: 'Maça',
          category: 'weapon',
          quantity: 1,
          weight: 2,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: 'str',
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: '1d6+2',
          damageType: 'contudent',
          weaponRange: '1,5 m',
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'arm-leather',
          name: 'Armadura de cuir',
          category: 'armor',
          quantity: 1,
          weight: 5,
          equipped: true,
          armorType: 'light',
          baseAc: 11,
          acBonus: 0,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'sh-1',
          name: 'Escut',
          category: 'shield',
          quantity: 1,
          weight: 3,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: 2,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'gear-1',
          name: 'Corda de cànem',
          category: 'gear',
          quantity: 1,
          weight: 5,
          equipped: false,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'mag-1',
          name: 'Amulets de protecció',
          category: 'magic_item',
          quantity: 1,
          weight: 0.2,
          equipped: true,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: true,
          attuned: true,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'tr-gem',
          name: 'Robí petit',
          category: 'treasure',
          quantity: 2,
          weight: 0.1,
          equipped: false,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
        {
          id: 'cust-1',
          name: 'Segell familiar',
          category: 'custom',
          quantity: 1,
          weight: null,
          equipped: false,
          armorType: null,
          baseAc: null,
          acBonus: null,
          requiresAttunement: false,
          attuned: false,
          weaponAbility: null,
          weaponAbilityOverride: null,
          weaponProficient: false,
          damage: null,
          damageType: null,
          weaponRange: null,
          weaponProperties: '',
          notes: '',
        },
      ];
      draft1.currency = { cp: 10, sp: 5, ep: 1, gp: 30, pp: 0 };

      const built1 = buildCharacterSheetPatch(rec1, draft1, access1);
      const updated1 = await updateCharacterBase(
        db,
        p1Ctx,
        camp.id,
        cleric.id,
        built1.payload as Parameters<typeof updateCharacterBase>[4]
      );

      // CA recalculada al servidor: cuir (11 + 1 DES) + escut (2) = 14
      expect(updated1.computed.combat.armorClass.value).toBe(14);
      // L'arma equipada genera un atac automàtic sense duplicats
      expect(updated1.computed.combat.attacks.filter((a) => a.inventoryItemId === 'wpn-mace')).toHaveLength(1);
      expect(updated1.computed.inventorySummary.attunement.attunedCount).toBe(1);
      expect(updated1.computed.inventorySummary.totalWeight).toBe(15.4);
      expect(updated1.computed.spellcasting?.slots[0]).toMatchObject({
        level: 1,
        total: 2,
        used: 1,
        available: 1,
      });

      // Desequipar la maça la fa desaparèixer dels atacs actius i desequipar l'escut redueix la CA
      const rec2: CharacterSheetRecord = {
        ...updated1,
        sheetData: updated1.sheetData as CharacterSheetRecord['sheetData'],
        createdAt: updated1.createdAt.toISOString(),
        updatedAt: updated1.updatedAt.toISOString(),
      };
      const draft2 = createDraftFromCharacter(rec2);
      draft2.inventory = draft2.inventory.map((item) =>
        item.id === 'wpn-mace' || item.id === 'sh-1' ? { ...item, equipped: false } : item
      );
      const built2 = buildCharacterSheetPatch(rec2, draft2, access1);
      const updated2 = await updateCharacterBase(
        db,
        p1Ctx,
        camp.id,
        cleric.id,
        built2.payload as Parameters<typeof updateCharacterBase>[4]
      );
      expect(updated2.computed.combat.attacks.some((a) => a.inventoryItemId === 'wpn-mace')).toBe(false);
      expect(updated2.computed.combat.armorClass.value).toBe(12);

      // Intentar excedir el límit de conjurs preparats (3 > 2) és rebutjat pel servidor
      await expect(
        updateCharacterBase(db, p1Ctx, camp.id, cleric.id, {
          sheetPatch: {
            spells: [
              ...draft1.spells,
              {
                id: 'sp-3',
                level: 1,
                name: 'Santuari',
                castingTime: '1 acció addicional',
                range: '9 m',
                components: 'V, S, M',
                duration: '1 minut',
                school: 'Abjuració',
                sourceType: 'class',
                sourceClassId: 'cleric',
                alwaysPrepared: false,
                prepared: true,
                inSpellbook: false,
                ritual: false,
                concentration: false,
                notes: '',
              },
            ],
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'SPELL_PREPARED_LIMIT_EXCEEDED' });

      // El GM pot afegir recursos personalitzats, overrides d'espais i modificar usos
      const gmUpdated = await updateCharacterBase(db, gm.ctx, camp.id, cleric.id, {
        sheetPatch: {
          customResources: [
            {
              id: 'cr-gm',
              name: 'Aura divina',
              maxUses: 3,
              recovery: 'long_rest',
              description: 'Concedida pel GM',
            },
          ],
          resourceUsage: { 'custom:cr-gm': 1 },
          spellSlotOverrides: { '1': 4 },
          attunement: { limitOverride: 4 },
        },
      });
      expect(gmUpdated.computed.resources.find((r) => r.usageKey === 'custom:cr-gm')).toMatchObject({
        totalUses: 3,
        used: 1,
        available: 2,
      });
      expect(gmUpdated.computed.spellcasting?.slots[0].total).toBe(4);
      expect(gmUpdated.computed.inventorySummary.attunement.maxSlots).toBe(4);
    } finally {
      await close();
    }
  });
});
