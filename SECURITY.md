# Seguretat i control d’accés

Totes les regles de seguretat s’apliquen **al servidor i a la capa de dades**, mai només ocultant controls a la interfície.

## Autenticació i gestió de secrets

- **Contrasenyes:** derivades amb `crypto.scrypt` (`N=16384, r=8, p=1`, sal aleatòria de 16 bytes, clau de 64 bytes) i comparació en temps constant (`crypto.timingSafeEqual`).
- **Tokens de sessió i d’invitació:** generats amb 256 bits aleatoris (`crypto.randomBytes(32)` en `base64url`). El servidor només retorna el token en clar una vegada en crear-lo i **emmagatzema exclusivament el hash SHA-256** (`token_hash`) a PostgreSQL.
- **Cookies de sessió:** `rol_session` marcada amb `HttpOnly`, `SameSite=Lax`, `Path=/` i `Secure` en producció.

## Registre tancat i bloqueig de comptes

- No existeix cap endpoint ni formulari públic per crear comptes de **GM** o **Administrador**.
- Només l’administrador principal (`role = 'admin'`) pot generar i revocar invitacions de GM; el registre verifica token vàlid, no usat, no revocat i coincidència exacta amb el `email` convidat.
- Quan un compte passa a `blocked` o `disabled`, es revoquen a l’instant totes les seves sessions actives a `sessions` i `resolveSession` el rebutja automàticament.

## Aïllament entre campanyes i rols

- Cada endpoint de campanya passa per `assertCampaignGm` o `assertCampaignAccess` ([src/server/auth/policies.ts](./src/server/auth/policies.ts)).
- Un GM només pot consultar, editar, enviar a la paperera, restaurar o convidar dins les campanyes on és `gm_user_id`.
- Un jugador registrat o convidat només pot accedir a les campanyes on té un registre `campaign_members` amb `status = 'active'` i on la campanya no és a la paperera.
- Canviar un UUID d’una altra campanya a la URL o a l’API retorna `403 Forbidden` (o `404` si no existeix), sense filtrar dades.
- La resposta `getCampaignDetail` per a jugadors i convidats omet les llistes d’invitacions, els comptes d’altres participants i els esdeveniments interns d’auditoria del GM (invitacions, recuperacions o revocacions).

## Visibilitat i permisos sobre personatges

- **Consulta dins la campanya:** tots els membres actius d’una campanya (GM, jugadors registrats i convidats) poden consultar la llista de personatges i les dades públiques de la fitxa dins la seva pròpia campanya (`listCampaignCharacters`, `getCampaignCharacter`).
- **Normalització segura (`v1 → v2`) i càlculs derivats al servidor:** les fitxes es normalitzen a l’esquema universal `D&D 5e (2014)` (`schemaVersion: 2`) sense pèrdua de dades i totes les peticions passen validació estricta **Zod** amb `.strict()` per rebutjar camps desconeguts, valors derivats falsificats, sintonitzacions impossibles (`attuned` sense `requiresAttunement` o superant el límit), característiques il·legals a `inventory.weaponAbility` o `attacks.ability`, inconsistències a `hitPoints.hitDiceUsedByDie`, historials de nivell incoherents (`progression.levelHistory`) o nivells per damunt de 20. Quan una fitxa antiga multiclasse només conserva `hitDiceUsed` global, el servidor manté `hitDiceUsedByDie: null` sense inventar mides de dau.
- **Protecció de camps privats del GM:** la columna `gm_notes`, la configuració `field_permissions` i qualsevol camí declarat dins `gmOnlyFields` s’eliminen al servidor (`stripGmOnlyFields`) abans d’enviar dades o calcular la instantània `computed` per a jugadors o convidats.
- **Protecció dels càlculs oficials de D&D 5e (2014):** les excepcions que alteren fórmules oficials (`savingThrows.overrides`, `skills.overrides`, `armorClass.override`, `initiative.override`, `initiative.bonus`, `attacks.ability`, `attacks.proficient`, `attacks.gmCustom`, `attacks.bonusOverride`, `attacks.attackBonus`, `inventory.weaponProficient`, `inventory.weaponAbilityOverride`, `attunement.limitOverride`, `spellcasting.abilityOverride`, `spellcasting.saveDcOverride`, `spellcasting.attackBonusOverride`, `spellcasting.sourceOverrides`, `spellSlotOverrides` i `customResources`) queden bloquejades per als jugadors (`403 OFFICIAL_CALCULATION_PROTECTED`), llevat que el GM els autoritzi explícitament camí a camí dins `fieldPermissions.authorizedOverrideFields`. Alhora, `computeAttacks()` diferencia estrictament atacs físics derivats de l’inventari (`weapon` / `weapon_override`), `unarmed`, `spell`, `special` i `gm_custom` perquè cap camp lliure no pugui concedir silenciosament característiques il·legals ni competències arbitràries. A més, el servidor valida el límit oficial de conjurs preparats per als jugadors (`400 SPELL_PREPARED_LIMIT_EXCEEDED`), mentre exclou trucs, `alwaysPrepared`, grimori i conjurs d’origen especial (`feature`/`race`/`item`).
- **Edició autoritzada:** un jugador o convidat només pot modificar el seu propi personatge (`member_id = access.member.id`) i únicament els camps inclosos a `playerEditableFields` que no figurin a `gmOnlyFields`. Els càlculs de descansos (`buildShortRestPatch`, `buildLongRestPatch`) també filtren les seccions restringides segons `fieldPermissions` i la tirada virtual amb `executeVirtualD20Check` exigeix `campaign.virtualDiceEnabled === true` (`403 VIRTUAL_DICE_DISABLED`). El GM pot consultar i modificar qualsevol personatge de la seva campanya.
- **Restriccions de creació i límits per jugador:** el servidor valida obligatòriament `max_characters_per_player` (en transacció) i les regles de `creation_config` (`freedomMode`, `startingLevel`, `allowedRaces`, `allowedClasses`, `allowedBackgrounds` i `requiredFields`), mantenint l’autoritat d’excepció del GM.

## Vinculació d’identitat de convidats

- Un convidat actiu (`kind = 'guest'`) pot vincular el seu accés a un compte nou (`role = 'player'`) o a un compte existent mitjançant `POST /api/auth/link-account`, verificant contrasenya al servidor en el segon cas.
- Quan el compte destí ja participava a la mateixa campanya, la fusió comprova que la identitat no estigui revocada, verifica que la suma de personatges no superi `max_characters_per_player`, transfereix personatges i referències sense duplicats i elimina el registre redundant.
- En completar la vinculació, es revoquen totes les sessions de convidat anteriors i qualsevol enllaç de recuperació pendent d’aquell membre, i s’emet una sessió de compte registrat.

## Invitacions de jugadors i recuperació segura d’accés

- Les invitacions d’entrada (`kind = 'join'`) són individuals, d’un sol ús atòmic, revocables i no caduquen automàticament.
- Els enllaços de recuperació (`kind = 'recovery'`) només es poden emetre per a membres convidats (`guest`) actius de la campanya i queden lligats al seu `target_member_id`.
- Emetre un nou enllaç de recuperació revoca els anteriors sense utilitzar del mateix membre; acceptar-lo revoca totes les sessions perdudes prèvies i només autentica aquell membre concret, evitant qualsevol suplantació d’identitat.
- Revocar un membre talla immediatament les seves sessions actives i els seus enllaços pendents.

## Auditoria

- Les operacions sensibles (bootstrap d’admin, inicis/tancaments de sessió, invitacions, bloquejos, canvis i paperera de campanyes, revocacions i recuperacions) es registren a `audit_logs` sense guardar mai tokens ni contrasenyes en clar.
