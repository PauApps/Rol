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

## Fase 3 — Personatges i fitxes D&D 5e (2014) *(En curs — Increments 1, 2, 3A i 3B completats; 3C pendent)*

- **Increment 1 *(Completat)*:** Model universal `v2` D&D 5e (2014), motor de regles pur (nivells 1–20 oficials, crítics exclusius d’atac, recursos modulars, tirades `d20`) i configuració `virtualDiceEnabled` controlada pel GM (`false` per defecte).
- **Increment 2 *(Completat)*:** Validació completa **Zod** (`dnd5e2014SheetSchema` i `dnd5e2014SheetPatchSchema`), compatibilitat retroactiva `v1 → v2` a `character-service.ts`, permisos granulars per secció/camp, protecció dels càlculs oficials davant jugadors, aplicació al servidor de `creationConfig` i proves de persistència/migracions.
- **Increment 3A *(Completat)*:** Auditoria funcional i visual de `docs/references/Fitxa_Interactiva_Pim_Bramble-v5.html` i definició de l’arquitectura de les 5 pestanyes de la fitxa universal D&D 5e (2014).
- **Increment 3B *(Completat + revisió correctiva aplicada)*:** Ampliació del model `v2` JSONB (`size`, `senses`, `rollModes`, `hitDiceUsedByDie`, `magic_item`, sintonització, propietats d’arma, `weaponAbilityOverride`, `attacks.kind`/`spellSourceClassId`/overrides, `spellcasting.sourceOverrides`, metadades de conjurs i `levelHistory`), motor pur d’atacs (`attacks.ts`) amb diferenciació estricta de tipus i bloqueig d’atacs no oficials, màgia per classe i multiclasse (`prepared`/`known`/`spellbook`/`pact`/`none`), descansos (`rests.ts`) per mida de dau (`d6`/`d8`/`d10`/`d12`), fites de progressió fins al nivell 20, recursos de les 12 classes i protecció de nous camins oficials i límit de preparats.
- **Increment 3C *(Pendent — proper pas)*:** Implementació de la interfície completa de les 5 pestanyes React, capçalera responsive, fluxos d’inventari/conjurs/descansos, camps personalitzats i còpia selectiva de configuració entre campanyes.

## Fase 4 — Historial, auditories de fitxa i biblioteca de manuals

- Enregistrament detallat a `character_revisions`, consulta d’historial i recuperació no destructiva de versions anteriors.
- Biblioteca de manuals i PDFs amb `StorageProvider` (local / S3-compatible), permisos per manual i cercador per paraules amb número de pàgina.

## Fase 5 — Funcionalitats ampliades i desplegament a producció

- Calendari de sessions, notes amb visibilitat granular, inventari compartit del grup i gestió de mapes.
- Internacionalització completa (`ca`, `es`, `en`) i temes visuals addicionals.
- Proves E2E amb navegador, verificació en PostgreSQL gestionat i preparació de capa d’assistència amb IA sense autoritat normativa.
