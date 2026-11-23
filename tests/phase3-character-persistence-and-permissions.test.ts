import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db';
import { getMigrationsFolder } from '@/db/config';
import { applyLockedMigrationsAndSeed } from '@/db/migrate';
import * as schema from '@/db/schema';
import { campaigns, characters } from '@/db/schema';
import { seedGameSystems } from '@/db/seed';
import {
  createCharacterRequestSchema,
  dnd5e2014SheetSchema,
  updateCharacterRequestSchema,
  type Dnd5e2014SheetPatchInput,
} from '@/domain/systems/dnd5e-2014';
import { resolveSession } from '@/server/auth/session';
import { loginWithPassword, logoutSession } from '@/server/services/auth-service';
import {
  createCampaign,
  updateCampaignCharacterRules,
} from '@/server/services/campaign-service';
import {
  createCharacterBase,
  getCampaignCharacter,
  updateCharacterBase,
} from '@/server/services/character-service';
import {
  acceptPlayerInvitation,
  createPlayerInvitation,
} from '@/server/services/player-invitation-service';
import { bootstrapAdmin, createInvitedGm } from './helpers';

describe('Fase 3 (Increment 2): Persistència v2, compatibilitat v1, validació Zod i permisos granulars', () => {
  it('crea i recupera fitxes v2 completes amb càlculs derivats i normalitza personatges v1 sense perdre dades', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.v2@rol.test', 'GM Universal');
      const camp = await createCampaign(db, gm.ctx, {
        name: 'Cròniques de Phandalin',
        systemId: 'dnd5e-2014',
      });

      const inv = await createPlayerInvitation(db, gm.ctx, camp.id);
      const reg = await acceptPlayerInvitation(db, inv.rawToken, {
        mode: 'register',
        email: 'clara@rol.test',
        displayName: 'Clara',
        password: 'PlayerPassword123!',
      });
      const playerCtx = await resolveSession(db, reg.rawToken);

      // 1. Crear personatge v2 complet (Clergue Domini de la Vida nivell 5)
      const createdV2 = await createCharacterBase(db, playerCtx, camp.id, {
        name: 'Serena Solà',
        sheetData: {
          generalInfo: {
            playerName: 'Clara',
            alignment: 'Legal Bo',
            faith: 'Lathander',
            appearanceNotes: 'Armadura brunyida i medalló solar.',
          },
          raceAndClass: {
            race: 'Humà',
            classes: [{ classId: 'cleric', subclassId: 'life-domain', level: 5 }],
          },
          abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 18, cha: 12 },
          savingThrows: { proficient: ['wis', 'cha'] },
          skills: { proficient: ['medicine', 'insight', 'religion'] },
          hitPoints: { max: 43, current: 43, temporary: 0, hitDice: '5d8', hitDiceUsed: 0 },
          inventory: [
            {
              id: 'arm-1',
              name: 'Cota de malles',
              category: 'armor',
              quantity: 1,
              weight: 55,
              equipped: true,
              armorType: 'heavy',
              baseAc: 16,
              acBonus: 0,
              notes: '',
            },
            {
              id: 'shd-1',
              name: 'Escut',
              category: 'shield',
              quantity: 1,
              weight: 6,
              equipped: true,
              armorType: null,
              baseAc: null,
              acBonus: 2,
              notes: '',
            },
          ],
          currency: { cp: 0, sp: 15, ep: 0, gp: 85, pp: 1 },
          spells: [
            {
              id: 'sp-1',
              level: 1,
              name: 'Beneir',
              prepared: true,
              inSpellbook: false,
              ritual: false,
              concentration: true,
              notes: '',
            },
          ],
          spellSlotsUsed: { '1': 1 },
          resourceUsage: { 'class:cleric:channel_divinity': 1 },
          background: {
            backgroundName: 'Acòlit',
            backstory: 'Servidora del temple de l’alba.',
            sessionNotes: [
              { id: 'sn-1', date: '2026-11-23', title: 'Sessió 1', content: 'Arribada a Phandalin.' },
            ],
          },
        },
      });

      expect(createdV2.schemaVersion).toBe(2);
      expect(createdV2.computed.totalLevel).toBe(5);
      expect(createdV2.computed.proficiencyBonus).toBe(3);
      expect(createdV2.computed.combat.armorClass.value).toBe(18);
      expect(createdV2.computed.spellcasting?.saveDc).toBe(15); // 8 + 3 + 4
      expect(createdV2.computed.spellcasting?.slots.find((s) => s.level === 1)?.available).toBe(3);

      const loadedV2 = await getCampaignCharacter(db, playerCtx, camp.id, createdV2.id);
      expect(loadedV2.schemaVersion).toBe(2);
      expect(loadedV2.computed.combat.armorClass.value).toBe(18);
      expect(loadedV2.computed.resources.find((r) => r.key === 'class:cleric:channel_divinity')?.used).toBe(1);

      // 2. Inserir un personatge v1 directe a BD i comprovar normalització segura + actualització a v2
      const [legacyRow] = await db
        .insert(characters)
        .values({
          campaignId: camp.id,
          memberId: reg.memberId,
          systemId: 'dnd5e-2014',
          name: 'Eldrin Vell',
          schemaVersion: 1,
          sheetData: {
            generalInfo: { name: 'Eldrin Vell', appearanceNotes: 'Barba llarga i bastó' },
            raceAndClass: {
              race: 'Alt Elf',
              classes: [{ name: 'Wizard', subclass: 'Evocació', level: 5 }],
            },
            abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 13, cha: 10 },
            spellSlots: { '1': { total: 4, used: 2 }, '2': { total: 3, used: 1 } },
            background: { backstory: 'Aprenent de Neverwinter.' },
          },
          customFields: {},
          fieldPermissions: {},
          gmNotes: 'Nota v1 secreta',
        })
        .returning();

      const loadedLegacy = await getCampaignCharacter(db, playerCtx, camp.id, legacyRow.id);
      const legacySheet = loadedLegacy.sheetData as ReturnType<typeof dnd5e2014SheetSchema.parse>;
      expect(legacySheet.raceAndClass.classes[0].classId).toBe('wizard');
      expect(legacySheet.raceAndClass.classes[0].level).toBe(5);
      expect(legacySheet.spellSlotsUsed).toEqual({ '1': 2, '2': 1 });
      expect(loadedLegacy.computed.spellcasting?.usesSpellbook).toBe(true);
      expect(loadedLegacy.computed.spellcasting?.saveDc).toBe(15); // 8 + 3 + 4
      expect('gmNotes' in loadedLegacy).toBe(false);

      // Actualitzar camps permesos sobre el personatge v1 el migra a v2 preservant les dades prèvies
      const upgradedLegacy = await updateCharacterBase(db, playerCtx, camp.id, legacyRow.id, {
        sheetPatch: {
          abilities: { int: 20 },
          currency: { gp: 120 },
          hitPoints: { max: 30, current: 22 },
          skills: { proficient: ['arcana', 'history'] },
          inventory: [
            {
              id: 'inv-staff',
              name: 'Bastó arcà',
              category: 'weapon',
              quantity: 1,
            },
          ],
          spells: [
            {
              id: 'sp-mm',
              level: 1,
              name: 'Projectil màgic',
              prepared: true,
              inSpellbook: true,
            },
          ],
          spellSlotsUsed: { '1': 3 },
          resourceUsage: { 'class:wizard:arcane_recovery': 1 },
          background: {
            sessionNotes: [
              { id: 'sn-eld', date: '2026-11-23', title: 'Torre arcana', content: 'Grimori recuperat.' },
            ],
          },
        },
      });
      expect(upgradedLegacy.schemaVersion).toBe(2);
      const upgradedSheet = upgradedLegacy.sheetData as typeof legacySheet;
      expect(upgradedSheet.background.backstory).toBe('Aprenent de Neverwinter.');
      expect(upgradedSheet.currency.gp).toBe(120);
      expect(upgradedSheet.inventory).toHaveLength(1);
      expect(upgradedSheet.spells[0]?.name).toBe('Projectil màgic');
      expect(upgradedSheet.background.sessionNotes).toHaveLength(1);
      expect(upgradedLegacy.computed.skills.find((s) => s.id === 'arcana')?.total).toBe(8); // +5 int +3 prof
      expect(upgradedLegacy.computed.spellcasting?.saveDc).toBe(16); // 8 + 3 + 5
      expect(upgradedLegacy.computed.spellcasting?.slots.find((s) => s.level === 1)?.available).toBe(1);
      expect(
        upgradedLegacy.computed.resources.find((r) => r.key === 'class:wizard:arcane_recovery')?.used
      ).toBe(1);
    } finally {
      await close();
    }
  });

  it('protegeix càlculs oficials contra jugadors, aplica permisos granulars i permet excepcions del GM', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.guard@rol.test', 'GM Seguretat');
      const campA = await createCampaign(db, gm.ctx, { name: 'Campanya A', systemId: 'dnd5e-2014' });
      const campB = await createCampaign(db, gm.ctx, { name: 'Campanya B', systemId: 'dnd5e-2014' });

      const invA1 = await createPlayerInvitation(db, gm.ctx, campA.id);
      const p1 = await acceptPlayerInvitation(db, invA1.rawToken, {
        mode: 'register',
        email: 'p1@rol.test',
        displayName: 'Jugador 1',
        password: 'PlayerPassword123!',
      });
      const p1Ctx = await resolveSession(db, p1.rawToken);

      const invA2 = await createPlayerInvitation(db, gm.ctx, campA.id);
      const p2 = await acceptPlayerInvitation(db, invA2.rawToken, {
        mode: 'guest',
        displayName: 'Jugador 2',
      });
      const p2Ctx = await resolveSession(db, p2.rawToken);

      const invB = await createPlayerInvitation(db, gm.ctx, campB.id);
      const pB = await acceptPlayerInvitation(db, invB.rawToken, {
        mode: 'guest',
        displayName: 'Jugador Campanya B',
      });
      const pBCtx = await resolveSession(db, pB.rawToken);

      // Esquema API rebutja claus desconegudes o intents d'injectar càlculs derivats / nivell > 20
      const invalidApiDerived = createCharacterRequestSchema.safeParse({
        name: 'Spoofer',
        sheetData: { proficiencyBonus: 10 },
      });
      expect(invalidApiDerived.success).toBe(false);

      const invalidApiLevel = updateCharacterRequestSchema.safeParse({
        sheetPatch: {
          raceAndClass: {
            classes: [
              { classId: 'fighter', level: 12 },
              { classId: 'wizard', level: 10 },
            ],
          },
        },
      });
      expect(invalidApiLevel.success).toBe(false);

      // El servidor també rebutja dades invàlides amb Zod tant en creació com en actualització
      await expect(
        createCharacterBase(db, p1Ctx, campA.id, {
          name: 'Invàlid Força',
          sheetData: { abilities: { str: 31 } },
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CHARACTER_SHEET' });

      await expect(
        createCharacterBase(db, p1Ctx, campA.id, {
          name: 'Invàlid Claus',
          sheetData: { computed: { armorClass: 30 } } as never,
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CHARACTER_SHEET' });

      // El jugador no pot introduir overrides oficials en creació (POST / createCharacterBase)
      await expect(
        createCharacterBase(db, p1Ctx, campA.id, {
          name: 'Trampós',
          sheetData: { armorClass: { override: 25 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      await expect(
        createCharacterBase(db, p1Ctx, campA.id, {
          name: 'Trampós 2',
          sheetData: { customResources: [{ id: 'x', name: 'Déu', maxUses: 99, recovery: 'short_rest', description: '' }] },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      // Creem personatges legítims per a P1 i P2
      const char1 = await createCharacterBase(db, p1Ctx, campA.id, {
        name: 'Lyra Vent',
        sheetData: {
          raceAndClass: { race: 'Elf', classes: [{ classId: 'rogue', level: 4 }] },
          abilities: { str: 10, dex: 18, con: 12, int: 14, wis: 12, cha: 10 },
        },
      });
      const char2 = await createCharacterBase(db, p2Ctx, campA.id, { name: 'Bram Ferreny' });

      // Rebuig Zod també en PATCH (moneda negativa o puntuació > 30)
      await expect(
        updateCharacterBase(db, p1Ctx, campA.id, char1.id, {
          sheetPatch: { currency: { gp: -10 } },
        })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_CHARACTER_SHEET' });

      // Tots els intents del jugador de tocar overrides oficials en PATCH queden bloquejats (403)
      const protectedPatches: Dnd5e2014SheetPatchInput[] = [
        { savingThrows: { overrides: { str: 15 } } },
        { skills: { overrides: { stealth: 25 } } },
        { armorClass: { override: 22 } },
        { initiative: { override: 15 } },
        { initiative: { bonus: 5 } },
        {
          attacks: [
            { id: 'a1', name: 'Daga', ability: 'dex', proficient: true, bonusOverride: 10 },
          ],
        },
        {
          attacks: [
            { id: 'a2', name: 'Arc', ability: 'dex', proficient: true, attackBonus: '+12' },
          ],
        },
        { spellcasting: { abilityOverride: 'cha' } },
        { spellcasting: { saveDcOverride: 22 } },
        { spellcasting: { attackBonusOverride: 14 } },
        { spellSlotOverrides: { '1': 9 } },
        { customResources: [{ id: 'cr1', name: 'Extra', maxUses: 5, recovery: 'long_rest', description: '' }] },
      ];

      for (const sheetPatch of protectedPatches) {
        await expect(
          updateCharacterBase(db, p1Ctx, campA.id, char1.id, { sheetPatch })
        ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });
      }

      // El jugador no pot modificar el personatge d'un altre jugador ni d'una altra campanya
      await expect(
        updateCharacterBase(db, p1Ctx, campA.id, char2.id, {
          sheetPatch: { hitPoints: { current: 0 } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'CHARACTER_EDIT_FORBIDDEN' });

      await expect(
        getCampaignCharacter(db, pBCtx, campA.id, char1.id)
      ).rejects.toMatchObject({ status: 403, code: 'CROSS_CAMPAIGN_FORBIDDEN' });

      // El GM pot aplicar overrides oficials, notes privades, camps gmOnly i desbloquejar una excepció puntual
      await updateCharacterBase(db, gm.ctx, campA.id, char1.id, {
        gmNotes: 'Objecte maleït ocult.',
        sheetPatch: {
          armorClass: { override: 17, notes: 'Escut màgic del GM' },
          customResources: [
            { id: 'blessing', name: 'Benedicció del Sol', maxUses: 2, recovery: 'long_rest', description: '' },
          ],
        },
        fieldPermissions: {
          gmOnlyFields: ['background.additionalNotes'],
          authorizedOverrideFields: ['armorClass.override'],
        },
      });

      // El jugador pot llegir la fitxa (sense gmNotes ni gmOnlyFields) i pot editar ÚNICAMENT l'override autoritzat
      const viewP1 = await getCampaignCharacter(db, p1Ctx, campA.id, char1.id);
      expect(viewP1.computed.combat.armorClass.value).toBe(17);
      expect(viewP1.authorizedOverrideFields).toEqual(['armorClass.override']);
      expect('gmNotes' in viewP1).toBe(false);
      expect((viewP1.sheetData.background as Record<string, unknown>).additionalNotes).toBeUndefined();

      const updatedAllowedOverride = await updateCharacterBase(db, p1Ctx, campA.id, char1.id, {
        sheetPatch: { armorClass: { override: 18 } },
      });
      expect(updatedAllowedOverride.computed.combat.armorClass.value).toBe(18);

      // La resta d'overrides continuen bloquejats, i el camp gmOnly bloquejat
      await expect(
        updateCharacterBase(db, p1Ctx, campA.id, char1.id, {
          sheetPatch: { skills: { overrides: { stealth: 20 } } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'OFFICIAL_CALCULATION_PROTECTED' });

      await expect(
        updateCharacterBase(db, p1Ctx, campA.id, char1.id, {
          sheetPatch: { background: { additionalNotes: 'Intentar tocar gmOnly' } },
        })
      ).rejects.toMatchObject({ status: 403, code: 'FIELD_EDIT_NOT_AUTHORIZED' });
    } finally {
      await close();
    }
  });

  it('aplica al servidor les restriccions de creació de campanya, persisteix entre sessions i conserva dades en migracions', async () => {
    const { db, close } = await createTestDb();
    try {
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.rules2@rol.test', 'GM Regles v2');

      const campStrict = await createCampaign(db, gm.ctx, {
        name: 'Campanya Estricta',
        systemId: 'dnd5e-2014',
      });
      await updateCampaignCharacterRules(db, gm.ctx, campStrict.id, {
        creationConfig: {
          freedomMode: 'strict',
          startingLevel: 2,
          allowedRaces: ['Humà', 'Nan'],
          allowedClasses: ['Guerrer', 'Clergue'],
          allowedBackgrounds: ['Soldat'],
          requiredFields: ['name', 'race', 'class', 'background', 'alignment'],
        },
      });

      const invStrict = await createPlayerInvitation(db, gm.ctx, campStrict.id);
      const regStrict = await acceptPlayerInvitation(db, invStrict.rawToken, {
        mode: 'register',
        email: 'strict.player@rol.test',
        displayName: 'Arnau',
        password: 'PlayerPassword123!',
      });
      const playerCtx1 = await resolveSession(db, regStrict.rawToken);

      // Rebutja raça no permesa, classe no permesa, nivell inicial incorrecte i camps obligatoris buits
      await expect(
        createCharacterBase(db, playerCtx1, campStrict.id, {
          name: 'Rebel',
          sheetData: {
            generalInfo: { alignment: 'Caòtic Neutral' },
            raceAndClass: { race: 'Tiefling', classes: [{ classId: 'fighter', level: 2 }] },
            background: { backgroundName: 'Soldat' },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      await expect(
        createCharacterBase(db, playerCtx1, campStrict.id, {
          name: 'Rebel Classe',
          sheetData: {
            generalInfo: { alignment: 'Legal Bo' },
            raceAndClass: { race: 'Humà', classes: [{ classId: 'wizard', level: 2 }] },
            background: { backgroundName: 'Soldat' },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      await expect(
        createCharacterBase(db, playerCtx1, campStrict.id, {
          name: 'Rebel Nivell',
          sheetData: {
            generalInfo: { alignment: 'Legal Bo' },
            raceAndClass: { race: 'Humà', classes: [{ classId: 'fighter', level: 1 }] },
            background: { backgroundName: 'Soldat' },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      await expect(
        createCharacterBase(db, playerCtx1, campStrict.id, {
          name: 'Sense Alineament',
          sheetData: {
            raceAndClass: { race: 'Humà', classes: [{ classId: 'fighter', level: 2 }] },
            background: { backgroundName: 'Soldat' },
          },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      // Accepta un personatge que compleix totes les restriccions ('Guerrer' <-> classId: 'fighter')
      const validStrict = await createCharacterBase(db, playerCtx1, campStrict.id, {
        name: 'Torin Escutfort',
        sheetData: {
          generalInfo: { alignment: 'Legal Bo' },
          raceAndClass: { race: 'Nan', classes: [{ classId: 'fighter', level: 2 }] },
          abilities: { str: 16, dex: 12, con: 15, int: 10, wis: 12, cha: 8 },
          background: { backgroundName: 'Soldat' },
        },
      });

      // També bloqueja canviar posteriorment a una raça no permesa o esborrar un camp obligatori
      await expect(
        updateCharacterBase(db, playerCtx1, campStrict.id, validStrict.id, {
          sheetPatch: { raceAndClass: { race: 'Elf' } },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      await expect(
        updateCharacterBase(db, playerCtx1, campStrict.id, validStrict.id, {
          sheetPatch: { generalInfo: { alignment: null } },
        })
      ).rejects.toMatchObject({ status: 400, code: 'CREATION_RESTRICTION_VIOLATION' });

      // El GM manté autoritat d'excepció sobre campanya estricta
      const gmException = await createCharacterBase(db, gm.ctx, campStrict.id, {
        name: 'Altaris Excepció',
        sheetData: {
          raceAndClass: { race: 'Dracònid', classes: [{ classId: 'sorcerer', level: 4 }] },
        },
      });
      expect(gmException.warnings.length).toBeGreaterThan(0);

      // Campanya guiada: permet desviacions amb advertiments però continua aplicant requiredFields
      const campGuided = await createCampaign(db, gm.ctx, {
        name: 'Campanya Guiada',
        systemId: 'dnd5e-2014',
      });
      await updateCampaignCharacterRules(db, gm.ctx, campGuided.id, {
        creationConfig: {
          freedomMode: 'guided',
          startingLevel: 1,
          allowedRaces: ['Humà'],
          requiredFields: ['name', 'race'],
        },
      });
      const invGuided = await createPlayerInvitation(db, gm.ctx, campGuided.id);
      const regGuided = await acceptPlayerInvitation(db, invGuided.rawToken, {
        mode: 'login',
        email: 'strict.player@rol.test',
        password: 'PlayerPassword123!',
      });
      const guidedCtx = await resolveSession(db, regGuided.rawToken);

      const guidedChar = await createCharacterBase(db, guidedCtx, campGuided.id, {
        name: 'Vael',
        sheetData: { raceAndClass: { race: 'Elf', classes: [{ classId: 'bard', level: 1 }] } },
      });
      expect(guidedChar.warnings.length).toBeGreaterThan(0);

      // Persistència real després de tancar sessió i tornar a iniciar sessió
      await updateCharacterBase(db, playerCtx1, campStrict.id, validStrict.id, {
        sheetPatch: {
          hitPoints: { max: 22, current: 19 },
          currency: { gp: 50 },
        },
      });

      await logoutSession(db, playerCtx1);
      expect(await resolveSession(db, regStrict.rawToken)).toBeNull();

      const relogin = await loginWithPassword(db, {
        email: 'strict.player@rol.test',
        password: 'PlayerPassword123!',
      });
      const playerCtx2 = await resolveSession(db, relogin.rawToken);

      const reloaded = await getCampaignCharacter(db, playerCtx2, campStrict.id, validStrict.id);
      const reloadedSheet = reloaded.sheetData as ReturnType<typeof dnd5e2014SheetSchema.parse>;
      expect(reloadedSheet.hitPoints.current).toBe(19);
      expect(reloadedSheet.currency.gp).toBe(50);
      expect(reloadedSheet.abilities.str).toBe(16);
      expect(reloaded.computed.totalLevel).toBe(2);
    } finally {
      await close();
    }
  });

  it('conserva campanyes i personatges v1 intactes quan s’apliquen les migracions incrementals (0000 -> 0001 -> 0002)', async () => {
    const client = new PGlite();
    await client.waitReady;
    const db = drizzlePglite(client, { schema });

    try {
      const migrationsFolder = getMigrationsFolder();
      const allMigrations = readMigrationFiles({ migrationsFolder });
      expect(allMigrations.length).toBeGreaterThanOrEqual(3);

      // Apliquem únicament les dues primeres migracions (0000 i 0001, anteriors a Fase 3)
      await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
          "id" serial PRIMARY KEY NOT NULL,
          "hash" text NOT NULL,
          "created_at" bigint
        )
      `);
      for (const mig of allMigrations.slice(0, 2)) {
        for (const stmt of mig.sql) {
          await db.execute(sql.raw(stmt));
        }
        await db.execute(sql`
          INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
          VALUES (${mig.hash}, ${mig.folderMillis})
        `);
      }

      // Sembrem sistema, usuari GM, campanya i personatge v1 sobre l'esquema pre-Fase 3
      await seedGameSystems(db);
      const admin = await bootstrapAdmin(db);
      const gm = await createInvitedGm(db, admin.ctx, 'gm.mig@rol.test', 'GM Migració');
      const campId = '11111111-1111-4111-8111-111111111111';
      await db.execute(sql`
        INSERT INTO "campaigns" ("id", "gm_user_id", "system_id", "name", "description")
        VALUES (${campId}, ${gm.user.id}, 'dnd5e-2014', 'Campanya Pre-Migració', 'Descripció històrica')
      `);
      const charId = '22222222-2222-4222-8222-222222222222';
      await db.execute(sql`
        INSERT INTO "characters" ("id", "campaign_id", "system_id", "name", "schema_version", "sheet_data")
        VALUES (
          ${charId},
          ${campId},
          'dnd5e-2014',
          'Milo Antiguitat',
          1,
          ${JSON.stringify({
            raceAndClass: { race: 'Halfling', classes: [{ name: 'Murri', level: 3 }] },
            abilities: { str: 8, dex: 16, con: 12, int: 13, wis: 10, cha: 14 },
          })}::jsonb
        )
      `);

      // Executem el migrador bloquejat complet fins a 0002_hard_firelord.sql
      const migResult = await applyLockedMigrationsAndSeed(db, migrationsFolder, {
        seedAdmin: false,
      });
      expect(migResult.appliedCount).toBe(allMigrations.length - 2);

      // Verifiquem zero pèrdua de dades i nou valor per defecte virtualDiceEnabled = false
      const [migratedCamp] = await db.select().from(campaigns);
      expect(migratedCamp.name).toBe('Campanya Pre-Migració');
      expect(migratedCamp.virtualDiceEnabled).toBe(false);

      const loadedMigratedChar = await getCampaignCharacter(db, gm.ctx, campId, charId);
      expect(loadedMigratedChar.name).toBe('Milo Antiguitat');
      expect(loadedMigratedChar.computed.totalLevel).toBe(3);
      expect(loadedMigratedChar.computed.abilities.dex.modifier).toBe(3);
    } finally {
      await client.close();
    }
  });
});
