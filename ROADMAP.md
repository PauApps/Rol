# Full de ruta (Roadmap)

Basat en la metodologia incremental de [DOCUMENT_MESTRE.md](./DOCUMENT_MESTRE.md) §14.

## Fase 1 — Base tècnica, autenticació, campanyes i invitacions *(Completada)*

- Bastida Next.js + TypeScript + Tailwind CSS + Drizzle ORM + PostgreSQL (PGlite en local).
- Tema visual `fantasy-classic` desacoplat i navegador lateral plegable responsive + PWA.
- Administrador principal, invitacions de GM tancades, registre de GM i bloqueig/desactivació de comptes.
- Creació ràpida de campanyes (`D&D 5e 2014`), estats (`activa`, `pausada`, `finalitzada`) i paperera de 30 dies.
- Invitacions individuals de jugadors (convidat amb àlies, nou compte o compte existent), revocació i recuperació d’accés segura.
- Model base de personatges i revisions preparat a BD sense càlculs improvisats.
- Suite de proves automatitzades d’autorització, aïllament i seguretat.

## Fase 2 — Configuració de campanya i vinculació d’identitats *(Completada)*

- Correcció d’auditoria de Fase 1: consulta grupal de personatges dins la mateixa campanya protegint `gm_notes`, `gmOnlyFields`, permisos d’edició granulars i activitat privada del GM.
- Configuració editable de creació de personatges pel GM (nivell inicial, races/classes/antecedents permesos, mètode de característiques, camps obligatoris, restriccions i grau de llibertat).
- Límit de personatges per jugador dins cada campanya validat transaccionalment al servidor.
- Flux segur perquè un convidat pugui vincular el seu accés i personatges a un compte registrat nou o existent sense duplicar membres ni personatges.

## Fase 3 — Personatges i fitxes D&D 5e (2014) *(En curs — Increments 1, 2, 3A, 3B, 3C.1, 3C.2 i 3C.2.1 completats; 3C.3–3C.4 pendents)*

- **Increment 1 *(Completat)*:** Model universal `v2` D&D 5e (2014), motor de regles pur (nivells 1–20 oficials, crítics exclusius d’atac, recursos modulars, tirades `d20`) i configuració `virtualDiceEnabled` controlada pel GM (`false` per defecte).
- **Increment 2 *(Completat)*:** Validació completa **Zod** (`dnd5e2014SheetSchema` i `dnd5e2014SheetPatchSchema`), compatibilitat retroactiva `v1 → v2` a `character-service.ts`, permisos granulars per secció/camp, protecció dels càlculs oficials davant jugadors, aplicació al servidor de `creationConfig` i proves de persistència/migracions.
- **Increment 3A *(Completat)*:** Auditoria funcional i visual de `docs/references/Fitxa_Interactiva_Pim_Bramble-v5.html` i definició de l’arquitectura de les 5 pestanyes de la fitxa universal D&D 5e (2014).
- **Increment 3B *(Completat + revisió correctiva aplicada)*:** Ampliació del model `v2` JSONB (`size`, `senses`, `rollModes`, `hitDiceUsedByDie`, `magic_item`, sintonització, propietats d’arma, `weaponAbilityOverride`, `attacks.kind`/`spellSourceClassId`/overrides, `spellcasting.sourceOverrides`, metadades de conjurs i `levelHistory`), motor pur d’atacs (`attacks.ts`) amb diferenciació estricta de tipus i bloqueig d’atacs no oficials, màgia per classe i multiclasse (`prepared`/`known`/`spellbook`/`pact`/`none`), descansos (`rests.ts`) per mida de dau (`d6`/`d8`/`d10`/`d12`), fites de progressió fins al nivell 20, recursos de les 12 classes i protecció de nous camins oficials i límit de preparats.
- **Increment 3C.1 *(Completat)*:** Ruta dedicada `/campaigns/[id]/characters/[characterId]`, capçalera persistent responsive alimentada exclusivament des de `computed`, navegació accessible per les 5 pestanyes, primera pestanya «Característiques i combat» funcional (6 característiques, 6 salvacions, 18 habilitats oficials, combat/vitalitat, daus de cop per mida amb protecció de fitxes antigues i atacs amb separació per `kind`), selectors de mode de tirada (`rollModes`), modal de gestió GM i integració amb `CampaignDetailClient.tsx`.
- **Increment 3C.2 *(Completat)*:** Pestanyes **«Màgia i habilitats»** (fonts de conjuració per classe i multiclasse, Màgia de Pacte diferenciada, espais 1r–9è i Pacte, llista de conjurs per nivell amb límit oficial de preparats i bloqueig de `alwaysPrepared`, recursos oficials i personalitzats i trets/aptituds) i **«Equipament i inventari»** (7 categories d’inventari sense duplicació d’armes, integració directa d’armes i armadures amb atacs/CA al servidor, sintonització i límit, 5 monedes i pes total sense capacitat de càrrega inventada).
- **Increment 3C.2.1 *(Completat)*:** Creació guiada pas a pas (`/campaigns/[id]/characters/new`) amb catàleg oficial D&D 5e 2014 (9 races amb subraces, 12 classes, 8 antecedents, paquets d’equipament, compra de punts/array estàndard/4d6/manual GM/lliure), validació al servidor de `abilityScoreMethod`, llistes permeses i camps obligatoris segons `freedomMode`, i modal `CharacterIdentityConfigModal` per editar identitat, raça/subraça, classes/nivells i competències des de la fitxa universal.
- **Increments 3C.3–3C.4 *(Pendents)*:**
  - **3C.3:** Pestanyes «Història i diari» i «Progressió i evolució».
  - **3C.4:** Endpoints i fluxos interactius de descansos curt/llarg, dau virtual amb historial de tirades, camps personalitzats i còpia selectiva de configuració entre campanyes.

## Fase 4 — Historial, auditories de fitxa i biblioteca de manuals

- Enregistrament detallat a `character_revisions`, consulta d’historial i recuperació no destructiva de versions anteriors.
- Biblioteca de manuals i PDFs amb `StorageProvider` (local / S3-compatible), permisos per manual i cercador per paraules amb número de pàgina.

## Fase 5 — Funcionalitats ampliades i desplegament a producció

- Calendari de sessions, notes amb visibilitat granular, inventari compartit del grup i gestió de mapes.
- Internacionalització completa (`ca`, `es`, `en`) i temes visuals addicionals.
- Proves E2E amb navegador, verificació en PostgreSQL gestionat i preparació de capa d’assistència amb IA sense autoritat normativa.
