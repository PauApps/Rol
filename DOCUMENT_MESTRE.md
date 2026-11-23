# **PROJECTE ROL**

## **Document mestre de requisits i especificacions**

**Nom del projecte:** Rol (nom de treball)  
**Versió:** 1.0  
**Estat:** Definició inicial aprovada  
**Sistema inicial:** Dungeons & Dragons 5a edició (2014)

---

# **1\. Visió del projecte**

Crear una plataforma web per ajudar els directors de joc (GM) a organitzar i gestionar les seves campanyes de rol presencials.

La plataforma serà una eina de suport i gestió. Les partides continuaran desenvolupant-se presencialment entre els participants.

No es pretén crear un videojoc, un entorn virtual de joc ni una plataforma de xat per interpretar personatges.

L'objectiu és centralitzar:

* Campanyes.  
* Jugadors.  
* Personatges i fitxes.  
* Manuals i regles.  
* Inventaris.  
* Sessions.  
* Notes.  
* Mapes.  
* Informació de campanya.

La plataforma ha de ser modular, escalable i preparada per incorporar nous sistemes de rol i funcionalitats.

# **2\. Principis fonamentals**

1. La facilitat d'ús és prioritària.  
2. El GM sempre té autoritat total sobre la seva campanya.  
3. Els jugadors poden consultar i modificar la informació segons els permisos.  
4. Les modificacions importants han de quedar registrades.  
5. Les funcionalitats han de ser reutilitzables per diferents sistemes de rol.  
6. La interfície ha de funcionar en ordinador, tauleta i mòbil.  
7. La plataforma ha de permetre canviar de temàtica visual sense modificar la lògica de l'aplicació.  
8. No s'ha d'integrar IA en el MVP.  
9. L'arquitectura ha de permetre incorporar IA en el futur.  
10. S'ha de prioritzar una arquitectura que permeti migrar de proveïdor sense reconstruir el projecte.

# **3\. Usuaris i permisos**

## **3.1 Administrador principal**

Només l'administrador principal pot:

* Convidar nous GM.  
* Consultar els comptes existents.  
* Bloquejar o desactivar comptes.  
* Gestionar els permisos generals de la plataforma.

Els GM no poden convidar altres GM.

## **3.2 GM**

Cada GM disposa d'un compte propi i pot:

* Crear diverses campanyes.  
* Gestionar els jugadors.  
* Crear i modificar personatges.  
* Consultar i modificar qualsevol fitxa de la seva campanya.  
* Gestionar manuals i permisos.  
* Consultar l'historial de modificacions.  
* Configurar les regles de creació de personatges.

Inicialment no hi ha límit de campanyes. L'arquitectura ha de permetre establir límits per compte o pla en el futur.

## **3.3 Jugadors**

Hi ha dues formes d'accés:

**Convidat**

* Entra mitjançant una invitació individual.  
* No necessita crear un compte.  
* Introdueix un nom o àlies.  
* Pot consultar la informació compartida.  
* Pot modificar la seva pròpia fitxa segons els permisos.  
* Pot perdre l'accés i necessitar un nou enllaç generat pel GM.

**Compte registrat**

* Pot participar en diverses campanyes.  
* Pot conservar el seu perfil.  
* Pot vincular personatges creats inicialment com a convidat.  
* Pot copiar la configuració bàsica d'un personatge per crear-ne un de nou en una altra campanya.

El personatge actiu sempre pertany a una única campanya.

## **3.4 Autoritat del GM**

El GM té autoritat total sobre la seva campanya.

Pot:

* Modificar qualsevol fitxa.  
* Canviar permisos.  
* Recuperar versions anteriors.  
* Modificar la configuració de creació de personatges.  
* Gestionar l'accés dels jugadors.

Els jugadors només poden modificar els camps que el GM els permeti.

# **4\. Campanyes**

## **4.1 Creació**

La creació d'una campanya ha de ser ràpida.

Només ha de demanar inicialment:

* Nom de la campanya.  
* Sistema de rol.

Inicialment només estarà disponible D\&D 5e 2014\.

La resta de configuració es farà després de crear-la.

## **4.2 Estat**

Cada campanya pot tenir tres estats:

* Activa.  
* Pausada.  
* Finalitzada.

Les campanyes finalitzades continuen accessibles.

## **4.3 Eliminació**

Les campanyes eliminades passen a una paperera.

* Es poden recuperar durant 30 dies.  
* Després es poden eliminar definitivament.  
* Cal protegir les dades davant eliminacions accidentals.  
* L'eliminació definitiva ha de tenir confirmació explícita.

## **4.4 Panell de campanya**

Cada campanya disposarà d'una pàgina principal amb:

* Nombre de jugadors.  
* Nombre de personatges.  
* Estat de la campanya.  
* Activitat recent.  
* Accés a les diferents seccions.

En fases posteriors s'hi podrà incorporar la pròxima sessió i altres indicadors.

# **5\. Invitacions i accés dels jugadors**

El GM generarà una invitació individual per cada jugador.

Cada invitació:

* Té un enllaç únic.  
* Està associada a una campanya.  
* No caduca automàticament.  
* Es pot revocar manualment.  
* Només es pot utilitzar una vegada per crear la vinculació inicial.

Quan el jugador accedeix, podrà:

1. Entrar com a convidat.  
2. Crear un compte.

Si entra com a convidat, haurà d'introduir un nom o àlies.

El GM podrà generar un nou enllaç d'accés per a un jugador existent que hagi perdut l'accés.

Els enllaços d'invitació i recuperació han de ser segurs, imprevisibles, revocables i no s'han de guardar en text pla al sistema.

Cal evitar que la recuperació d'accés permeti suplantar altres jugadors.

# **6\. Personatges i fitxes**

## **6.1 Sistema inicial**

La primera fitxa serà de D\&D 5e 2014\.

No s'han de barrejar les regles de 2014 i 2024\.

L'arquitectura ha de permetre incorporar altres sistemes en el futur.

## **6.2 Fitxa base**

La fitxa ha de ser reutilitzable per qualsevol classe i personatge.

Ha d'incloure els apartats necessaris de D\&D 5e:

* Informació general.  
* Raça i classe.  
* Característiques.  
* Modificadors.  
* Salvacions.  
* Habilitats.  
* Competències.  
* Punts de cop.  
* Classe d'armadura.  
* Iniciativa.  
* Velocitat.  
* Atacs.  
* Equipament i inventari.  
* Monedes.  
* Trets i aptituds.  
* Conjurs.  
* Espais de conjur.  
* Progressió i experiència.  
* Història i antecedents.

La fitxa ha de poder ampliar-se amb camps personalitzats.

## **6.3 Càlculs**

Els càlculs habituals han de ser automàtics:

* Modificadors de característiques.  
* Bonificació de competència.  
* Salvacions.  
* Habilitats.  
* Classe d'armadura quan correspongui.  
* Altres valors derivats.

El GM pot configurar excepcions per regles especials o contingut homebrew.

Els càlculs oficials han d'estar protegits per defecte.

## **6.4 Configuració de creació**

El GM pot establir:

* Nivell inicial.  
* Races permeses.  
* Classes permeses.  
* Antecedents.  
* Mètode per generar característiques.  
* Restriccions.  
* Camps obligatoris.  
* Grau de llibertat dels jugadors.

També pot deixar la creació completament lliure.

## **6.5 Nombre de personatges**

El GM decideix quants personatges pot tenir cada jugador dins la campanya.

## **6.6 Copiar personatges**

Un jugador podrà copiar la configuració bàsica d'un personatge per iniciar-ne un de nou en una altra campanya.

Podrà seleccionar quines dades vol conservar.

No s'han de copiar automàticament:

* Inventari.  
* Experiència.  
* Progressió.  
* Recursos consumibles.  
* Estat actual del personatge.

# **7\. Historial i auditories**

Tots els canvis importants a les fitxes han de quedar registrats.

Cada registre ha d'incloure:

* Personatge afectat.  
* Usuari que ha fet el canvi.  
* Data i hora.  
* Camp modificat.  
* Valor anterior.  
* Valor nou.  
* Motiu opcional.  
* Sessió relacionada, si escau.

El GM podrà consultar l'historial i recuperar versions anteriors.

Recuperar una versió no ha d'esborrar els canvis posteriors. Ha de crear una nova modificació registrada.

El sistema ha de garantir que els jugadors no puguin alterar ni eliminar l'historial.

# **8\. Manuals i regles**

## **8.1 Biblioteca**

La biblioteca inicial només podrà contenir contingut de domini públic, contingut lliure o material amb llicència adequada.

El GM podrà pujar documents i PDFs propis que tengui dret a utilitzar.

No es distribuiran manuals comercials protegits sense autorització.

## **8.2 Permisos**

El GM podrà decidir manual per manual:

* Només GM.  
* Accessible a tots els jugadors.  
* Accessible només a determinats jugadors.

## **8.3 Cercador**

Primera versió:

* Cerca per paraules i expressions.  
* Resultats amb fragments.  
* Nom del manual.  
* Número de pàgina quan sigui possible.

Futur:

* Cerca contextual.  
* Assistència amb IA.  
* Respostes basades en manuals.  
* Referències i cites de les fonts.

La IA no serà mai l'autoritat normativa del sistema.

# **9\. Funcionalitats posteriors al MVP**

Aquestes funcionalitats s'han de tenir en compte en l'arquitectura, però no s'han de desenvolupar abans de completar el MVP.

## **Calendari i sessions**

* Programar sessions.  
* Data, hora i lloc.  
* Confirmació d'assistència.  
* Participants.  
* Resums de sessions.

## **Notes**

* Privades del GM.  
* Compartides amb tots.  
* Compartides selectivament.

## **Inventaris**

* Inventari individual.  
* Inventari compartit del grup.  
* Historial de modificacions.  
* Futurs cofres i magatzems.

## **Mapes**

* Pujar imatges.  
* Organitzar mapes.  
* Establir permisos.  
* Futurs marcadors i anotacions.

## **Eines del GM**

* Calculadora d'experiència.  
* Consulta ràpida de regles.  
* Futures eines de gestió de trobades i altres recursos.

No es desenvoluparà un sistema de joc virtual ni un gestor de combat al MVP.

# **10\. Disseny i experiència d'usuari**

## **10.1 Identitat visual**

Estil de fantasia elegant:

* Inspiració en llibres antics.  
* Màgia i aventures.  
* Detalls refinats.  
* Evitar tòpics visuals excessius com dracs, espases i escuts a tot arreu.

La llegibilitat sempre és prioritària.

## **10.2 Temàtiques**

La primera temàtica serà fantasia clàssica, amb:

* Textures de pergamí.  
* Tipografia d'inspiració medieval.  
* Colors càlids.  
* Ornaments subtils.

La temàtica ha d'estar separada de la lògica de l'aplicació.

En el futur es podran incorporar temes moderns i altres estils.

## **10.3 Navegació**

* Menú lateral plegable.  
* Desplegat: icones i textos.  
* Plegat: només icones.  
* Adaptació específica per a mòbil.

## **10.4 Panell inicial del GM**

Panell senzill amb un botó destacat per crear la primera campanya.

No s'ha de forçar un tutorial inicial.

## **10.5 Responsive**

* Ordinador: gestió completa.  
* Tauleta: gestió i consulta.  
* Mòbil: consulta ràpida i modificacions senzilles.

# **11\. Tecnologia i arquitectura**

Les decisions concretes de tecnologia encara s'han de validar.

Criteris obligatoris:

* Aplicació web responsive.  
* PWA instal·lable.  
* Connexió a internet obligatòria.  
* Autenticació segura.  
* Base de dades relacional o equivalent amb integritat referencial.  
* Emmagatzematge segur de documents.  
* Control d'accés per campanya i usuari.  
* Historial de canvis.  
* Possibilitat de migrar de proveïdor.  
* Separació entre interfície, lògica de negoci i dades.  
* Internacionalització des del principi.

Començar en català.

Preparar l'aplicació per incorporar castellà i anglès.

L'idioma de la interfície i l'idioma dels manuals han de ser independents.

No integrar IA en el MVP.

No dependre de serveis gratuïts amb límits que puguin fer inviable el projecte. Es poden prioritzar plans gratuïts inicials, sempre que hi hagi una via de migració.

# **12\. MVP: primera versió funcional**

El MVP aprovat inclou:

1. Autenticació de GM.  
2. Registre de GM només per invitació de l'administrador principal.  
3. Creació de campanyes.  
4. Gestió bàsica de campanyes.  
5. Invitacions individuals de jugadors.  
6. Accés de convidats i comptes registrats.  
7. Creació de personatges D\&D 5e 2014\.  
8. Consulta i modificació de fitxes.  
9. Permisos de GM i jugadors.  
10. Historial de modificacions.

La fitxa HTML existent d'en Pim Bramble és una referència visual i funcional. S'ha d'auditar i adaptar, no copiar directament ni convertir-la sense revisar-la en una aplicació multiusuari.

# **13\. Criteris de qualitat**

No considerar el MVP acabat fins que:

* Un administrador pugui convidar un GM.  
* Un GM pugui registrar-se amb la invitació.  
* Un GM pugui crear una campanya.  
* Un GM pugui generar una invitació individual.  
* Un jugador pugui entrar com a convidat.  
* Un jugador pugui crear un compte.  
* Un GM pugui crear i gestionar personatges.  
* Un jugador només pugui editar els camps autoritzats.  
* El GM pugui editar qualsevol fitxa.  
* Els canvis quedin registrats.  
* L'historial sigui consultable.  
* Les dades d'una campanya no siguin accessibles des d'una altra.  
* Les invitacions revocades no funcionin.  
* L'aplicació sigui utilitzable en ordinador i mòbil.  
* Els càlculs bàsics de la fitxa estiguin provats.

# **14\. Metodologia de desenvolupament**

El desenvolupament s'ha de fer per fases petites i verificables.

Ordre recomanat:

**Fase 1:** arquitectura, autenticació i permisos.

**Fase 2:** campanyes i invitacions.

**Fase 3:** personatges i fitxes.

**Fase 4:** historial i auditories.

**Fase 5:** proves integrals, seguretat i desplegament.

Cada fase ha de deixar una versió funcional.

No s'han de crear pantalles fictícies que aparentin tenir funcionalitat quan encara no existeix.

No s'han d'amagar errors ni substituir funcionalitats reals per dades simulades en producció.

Les decisions tècniques s'han de documentar.

Qualsevol canvi respecte d'aquest document ha de quedar justificat i documentat.

---

**Fi del document mestre.**

