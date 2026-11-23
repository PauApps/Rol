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
- La resposta `getCampaignDetail` per a jugadors i convidats omet les llistes d’invitacions i els comptes d’altres participants; les consultes de personatges restringeixen els jugadors únicament als seus propis personatges.

## Invitacions de jugadors i recuperació segura d’accés

- Les invitacions d’entrada (`kind = 'join'`) són individuals, d’un sol ús atòmic, revocables i no caduquen automàticament.
- Els enllaços de recuperació (`kind = 'recovery'`) només es poden emetre per a membres convidats (`guest`) actius de la campanya i queden lligats al seu `target_member_id`.
- Emetre un nou enllaç de recuperació revoca els anteriors sense utilitzar del mateix membre; acceptar-lo revoca totes les sessions perdudes prèvies i només autentica aquell membre concret, evitant qualsevol suplantació d’identitat.
- Revocar un membre talla immediatament les seves sessions actives i els seus enllaços pendents.

## Auditoria

- Les operacions sensibles (bootstrap d’admin, inicis/tancaments de sessió, invitacions, bloquejos, canvis i paperera de campanyes, revocacions i recuperacions) es registren a `audit_logs` sense guardar mai tokens ni contrasenyes en clar.
