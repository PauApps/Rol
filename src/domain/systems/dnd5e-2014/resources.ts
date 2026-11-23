import {
  MAX_OFFICIAL_LEVEL_2014,
  MIN_OFFICIAL_LEVEL_2014,
  getClassEntry,
  getSubclassEntry,
  type AbilityKey,
} from './catalog';
import type { Dnd5e2014SheetData, ResourceRecovery } from './schema';

export interface ComputedCharacterResource {
  key: string;
  usageKey: string;
  name: string;
  source: string;
  totalUses: number | null;
  unlimited: boolean;
  used: number;
  available: number | null;
  recovery: ResourceRecovery;
  description: string;
  isCustom: boolean;
}

function makeResource(
  params: {
    key: string;
    usageKey?: string;
    name: string;
    source: string;
    totalUses: number | null;
    unlimited?: boolean;
    recovery: ResourceRecovery;
    description: string;
    isCustom?: boolean;
  },
  usageMap: Record<string, number>
): ComputedCharacterResource {
  const usageKey = params.usageKey ?? params.key;
  const unlimited = Boolean(params.unlimited);
  const rawUsed = usageMap[usageKey] ?? 0;
  const used = unlimited
    ? Math.max(0, rawUsed)
    : Math.min(params.totalUses ?? 0, Math.max(0, rawUsed));
  const available = unlimited
    ? null
    : Math.max(0, (params.totalUses ?? 0) - used);

  return {
    key: params.key,
    usageKey,
    name: params.name,
    source: params.source,
    totalUses: params.totalUses,
    unlimited,
    used,
    available,
    recovery: params.recovery,
    description: params.description,
    isCustom: Boolean(params.isCustom),
  };
}

/**
 * Generates ONLY the class, subclass, and custom resources applicable to this character
 * according to D&D 5e (2014) progression. Never injects Pim-specific or unrelated resources.
 */
export function computeCharacterResources(
  sheet: Dnd5e2014SheetData,
  abilityMods: Record<AbilityKey, number | null>,
  proficiencyBonus: number
): ComputedCharacterResource[] {
  const resources: ComputedCharacterResource[] = [];
  const usage = sheet.resourceUsage ?? {};
  const chaMod = abilityMods.cha ?? 0;

  for (const cls of sheet.raceAndClass.classes) {
    const level = Math.min(
      MAX_OFFICIAL_LEVEL_2014,
      Math.max(MIN_OFFICIAL_LEVEL_2014, Math.floor(cls.level))
    );
    const classMeta = getClassEntry(cls.classId);
    const classLabel = cls.customClassName?.trim() || classMeta?.labelCa || cls.classId;
    const subclassMeta = getSubclassEntry(cls.subclassId);
    const subclassLabel = cls.customSubclassName?.trim() || subclassMeta?.labelCa || cls.subclassId || '';

    switch (cls.classId) {
      case 'barbarian': {
        const unlimited = level >= 20;
        const total =
          unlimited ? null : level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
        resources.push(
          makeResource(
            {
              key: 'class:barbarian:rage',
              name: 'Ira',
              source: classLabel,
              totalUses: total,
              unlimited,
              recovery: 'long_rest',
              description: 'Fúria de combat amb bonificador de dany cos a cos i resistència.',
            },
            usage
          )
        );
        break;
      }

      case 'bard': {
        resources.push(
          makeResource(
            {
              key: 'class:bard:bardic_inspiration',
              name: 'Inspiració bàrdica',
              source: classLabel,
              totalUses: Math.max(1, chaMod),
              recovery: level >= 5 ? 'short_rest' : 'long_rest',
              description: 'Dau d’inspiració per atorgar a aliats (recuperació curta a partir de nivell 5).',
            },
            usage
          )
        );
        break;
      }

      case 'cleric': {
        if (level >= 2) {
          const total = level >= 18 ? 3 : level >= 6 ? 2 : 1;
          resources.push(
            makeResource(
              {
                key: 'class:cleric:channel_divinity',
                name: 'Canalitzar divinitat',
                source: classLabel,
                totalUses: total,
                recovery: 'short_rest',
                description: 'Canalitza energia divina per expulsar no-morts o efectes del domini.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'druid': {
        if (level >= 2) {
          const unlimited = level >= 20;
          resources.push(
            makeResource(
              {
                key: 'class:druid:wild_shape',
                name: 'Forma salvatge',
                source: classLabel,
                totalUses: unlimited ? null : 2,
                unlimited,
                recovery: 'short_rest',
                description: 'Transformació en bèstia o ús alternatiu segons el cercle druídic.',
              },
              usage
            )
          );

          if (cls.subclassId === 'circle-of-stars') {
            resources.push(
              makeResource(
                {
                  key: 'subclass:circle-of-stars:starry_form',
                  usageKey: 'class:druid:wild_shape',
                  name: 'Forma estel·lar',
                  source: subclassLabel || 'Cercle de les Estrelles',
                  totalUses: unlimited ? null : 2,
                  unlimited,
                  recovery: 'short_rest',
                  description:
                    'Consumeix un ús de Forma salvatge per adoptar constel·lació (Arquer, Calze o Drac).',
                },
                usage
              )
            );
            resources.push(
              makeResource(
                {
                  key: 'subclass:circle-of-stars:star_map',
                  name: 'Mapa estel·lar (Guia / Raig traçador)',
                  source: subclassLabel || 'Cercle de les Estrelles',
                  totalUses: proficiencyBonus,
                  recovery: 'long_rest',
                  description: 'Llançaments gratuïts sense consumir espai de conjur (segons competència).',
                },
                usage
              )
            );
          }
        }
        break;
      }

      case 'fighter': {
        resources.push(
          makeResource(
            {
              key: 'class:fighter:second_wind',
              name: 'Segon alè',
              source: classLabel,
              totalUses: 1,
              recovery: 'short_rest',
              description: 'Recupera punts de cop amb una acció addicional (1d10 + nivell de guerrer).',
            },
            usage
          )
        );
        if (level >= 2) {
          resources.push(
            makeResource(
              {
                key: 'class:fighter:action_surge',
                name: 'Acció sobtada',
                source: classLabel,
                totalUses: level >= 17 ? 2 : 1,
                recovery: 'short_rest',
                description: 'Guanya una acció addicional durant el teu torn.',
              },
              usage
            )
          );
        }
        if (level >= 9) {
          resources.push(
            makeResource(
              {
                key: 'class:fighter:indomitable',
                name: 'Indomable',
                source: classLabel,
                totalUses: level >= 17 ? 3 : level >= 13 ? 2 : 1,
                recovery: 'long_rest',
                description: 'Permet repetir una tirada de salvació fallada.',
              },
              usage
            )
          );
        }
        if (level >= 3 && cls.subclassId === 'battle-master') {
          const diceCount = level >= 15 ? 6 : level >= 7 ? 5 : 4;
          resources.push(
            makeResource(
              {
                key: 'subclass:battle-master:superiority_dice',
                name: 'Daus de superioritat',
                source: subclassLabel || 'Mestre de Batalla',
                totalUses: diceCount,
                recovery: 'short_rest',
                description: 'Daus per executar maniobres tàctiques de combat.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'monk': {
        if (level >= 2) {
          resources.push(
            makeResource(
              {
                key: 'class:monk:ki',
                name: 'Punts de Ki',
                source: classLabel,
                totalUses: level,
                recovery: 'short_rest',
                description: 'Reserva d’energia interior per a tècniques marcials.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'paladin': {
        resources.push(
          makeResource(
            {
              key: 'class:paladin:divine_sense',
              name: 'Sentit diví',
              source: classLabel,
              totalUses: 1 + Math.max(0, chaMod),
              recovery: 'long_rest',
              description: 'Detecta celestials, infernals i no-morts propers.',
            },
            usage
          )
        );
        resources.push(
          makeResource(
            {
              key: 'class:paladin:lay_on_hands',
              name: 'Imposició de mans (punts)',
              source: classLabel,
              totalUses: level * 5,
              recovery: 'long_rest',
              description: 'Reserva de punts de curació o eliminació de malalties i verins.',
            },
            usage
          )
        );
        if (level >= 3) {
          resources.push(
            makeResource(
              {
                key: 'class:paladin:channel_divinity',
                name: 'Canalitzar divinitat',
                source: classLabel,
                totalUses: 1,
                recovery: 'short_rest',
                description: 'Ús del vot sagrat del paladí.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'rogue': {
        if (level >= 20) {
          resources.push(
            makeResource(
              {
                key: 'class:rogue:stroke_of_luck',
                name: 'Cop de sort',
                source: classLabel,
                totalUses: 1,
                recovery: 'short_rest',
                description: 'Converteix un atac fallat en impacte o una prova fallada en un 20.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'sorcerer': {
        if (level >= 2) {
          resources.push(
            makeResource(
              {
                key: 'class:sorcerer:sorcery_points',
                name: 'Punts de bruixeria',
                source: classLabel,
                totalUses: level,
                recovery: 'long_rest',
                description: 'Reserva per a metamàgia i conversió flexible d’espais de conjur.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'warlock': {
        const arcanumCount =
          (level >= 11 ? 1 : 0) +
          (level >= 13 ? 1 : 0) +
          (level >= 15 ? 1 : 0) +
          (level >= 17 ? 1 : 0);
        if (arcanumCount > 0) {
          resources.push(
            makeResource(
              {
                key: 'class:warlock:mystic_arcanum',
                name: 'Arcanum místic (cercles 6è–9è)',
                source: classLabel,
                totalUses: arcanumCount,
                recovery: 'long_rest',
                description: 'Un ús diari per cada cercle d’Arcanum místic desbloquejat.',
              },
              usage
            )
          );
        }
        break;
      }

      case 'wizard': {
        resources.push(
          makeResource(
            {
              key: 'class:wizard:arcane_recovery',
              name: 'Recuperació arcana',
              source: classLabel,
              totalUses: 1,
              recovery: 'long_rest',
              description: `Recupera espais de conjur fins a un total de ${Math.ceil(level / 2)} nivell(s) durant un descans curt.`,
            },
            usage
          )
        );
        break;
      }

      default:
        break;
    }
  }

  for (const custom of sheet.customResources ?? []) {
    resources.push(
      makeResource(
        {
          key: `custom:${custom.id}`,
          name: custom.name,
          source: 'Personalitzat',
          totalUses: Math.max(0, Math.floor(custom.maxUses)),
          recovery: custom.recovery,
          description: custom.description,
          isCustom: true,
        },
        usage
      )
    );
  }

  return resources;
}
