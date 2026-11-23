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

## Fase 2 — Configuració de campanya i vinculació d’identitats

- Configuració de creació de personatges pel GM (nivell inicial, races/classes/antecedents permesos, mètode de característiques, creació lliure).
- Límit de personatges per jugador dins cada campanya.
- Flux perquè un convidat pugui vincular el seu historial i personatges a un compte registrat nou o existent.

## Fase 3 — Personatges i fitxes D&D 5e (2014)

- Auditoria prèvia de la fitxa HTML de referència d’en Pim Bramble.
- Implementació completa de tots els apartats de fitxa (`DOCUMENT_MESTRE.md` §6.2) i camps personalitzats.
- Motor compartit de càlculs oficials D&D 5e (2014) protegits per defecte + excepcions configurables pel GM (homebrew).
- Permisos granulars d’edició per camp (GM vs jugador) i còpia selectiva de configuració bàsica entre campanyes.

## Fase 4 — Historial, auditories de fitxa i biblioteca de manuals

- Enregistrament detallat a `character_revisions`, consulta d’historial i recuperació no destructiva de versions anteriors.
- Biblioteca de manuals i PDFs amb `StorageProvider` (local / S3-compatible), permisos per manual i cercador per paraules amb número de pàgina.

## Fase 5 — Funcionalitats ampliades i desplegament a producció

- Calendari de sessions, notes amb visibilitat granular, inventari compartit del grup i gestió de mapes.
- Internacionalització completa (`ca`, `es`, `en`) i temes visuals addicionals.
- Proves E2E amb navegador, verificació en PostgreSQL gestionat i preparació de capa d’assistència amb IA sense autoritat normativa.
