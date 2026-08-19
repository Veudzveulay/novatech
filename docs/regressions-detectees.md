# Défauts détectés par la suite de tests

> Livrable **L2** · établi le 23/07/2026 · remédiation synchronisée le 19/08/2026
> **23 défauts** confirmés par des tests exécutables. **3 corrigés à ce jour**
> (VULN-02, VULN-03, VULN-09), les 20 autres restent ouverts.
>
> Le L2 n'a corrigé aucun défaut : il les a constatés. Les corrections
> ci-dessous ont été apportées pendant la remédiation du J3 (Anna), et **chaque
> correction s'accompagne de la réécriture du test en non-régression** — c'est
> exactement le mécanisme prévu par ce document. Voir l'état détaillé en fin de
> fichier.

---

## Comment lire ce document

Chaque défaut porte un identifiant utilisé **tel quel dans le nom des tests**.
`grep -r "VULN-01" tests/` donne directement les tests qui le démontrent.

Ces tests **constatent le comportement actuel**. Ils sont donc verts aujourd'hui
et **deviendront rouges le jour où le défaut sera corrigé**. C'est délibéré :

> Un test qui devient rouge après une correction est un signal, pas une panne.
> Procédure : inverser l'assertion, retirer le préfixe `VULN-`/`BUG-` du nom du
> test, et cocher la ligne correspondante ci-dessous.

Sans ce mécanisme, une correction pourrait être annulée par un `revert` sans que
rien ne l'indique — ce qui est exactement ce qui s'est produit avec le
middleware d'authentification en mars 2024.

---

## Vulnérabilités

### VULN-01 — Injection SQL dans l'authentification · **Critique**

`services/auth/src/app.js:12` — l'email est concaténé dans la requête :

```js
const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`)
```

**Démontré par** : `tests/unit/auth.test.js` (la charge utile arrive non
paramétrée dans la requête) et `tests/integration/auth.integration.test.js`
(PostgreSQL exécute réellement la charge, un JWT de rôle `rh` est délivré à qui
n'a jamais fourni l'adresse email correspondante).

**Contre-épreuve** : le service Congés, soumis à la même charge, la traite comme
une valeur — la faille est propre au service Auth, pas générale.

- [ ] Corrigé — remplacer par `pool.query('SELECT * FROM users WHERE email = $1', [email])`

---

### VULN-02 — Secret JWT codé en dur · **Critique**

`services/auth/src/app.js:20 et 29` — repli sur
`'novatech_jwt_super_secret_key_2021_do_not_share'`, valeur également présente
en clair dans `.env`, lui-même commité (`24b295b`). Quiconque a lu le dépôt peut
forger un jeton de rôle `rh`.

Aggravant : `server.js` journalise `JWT_SECRET` au démarrage.

**Démontré par** : `tests/unit/auth.test.js` — sans `JWT_SECRET` défini, le
jeton émis se vérifie avec le secret du dépôt.

- [x] **Corrigé (19/08)** — repli codé en dur supprimé ; le test asserte désormais qu'aucun secret du dépôt ne fait foi.

---

### VULN-03 — Clé Stripe `sk_live_` codée en dur · **Critique**

`services/paie/src/app.js:24` — repli sur une clé de production. La route
`/paie/calculer` déclenche un virement réel.

**Démontré par** : `tests/unit/paie.test.js` — sans `STRIPE_SECRET_KEY`, l'appel
part avec `Bearer sk_live_51NovaTech2021...`.

**Conséquence sur les tests** : `axios` est mocké dans toute la suite, et les
E2E démarrent le service de paie derrière un proxy mort. Aucun appel sortant ne
quitte l'environnement de test.

- [x] **Corrigé (19/08)** — clé `sk_live_` en dur supprimée ; sans `STRIPE_SECRET_KEY`, aucun appel n'est émis (test SECURITY dans `paie.test.js`).

---

### VULN-04 — Route de migration non authentifiée · **Élevé**

`services/paie/src/app.js:33` — `POST /paie/migrate` exécute du DDL
(`ALTER TABLE`) et un `UPDATE` sur toute la table `employees`, sans le moindre
contrôle. Elle renvoie en outre le message d'erreur PostgreSQL brut au client.

**Démontré par** : `tests/unit/paie.test.js`, `tests/integration/paie.integration.test.js`
(la colonne est réellement ajoutée par un appel HTTP anonyme, et `updated_at`
est réécrit sur toutes les lignes), `tests/e2e/03-cycle-paie.spec.js`.

- [ ] Corrigé — supprimer la route, migrations par outil dédié dans le pipeline

---

### VULN-05 — Aucune authentification sur la passerelle · **Critique**

`services/api-gateway/src/app.js` — les 4 routes `/api/*` sont proxifiées sans
contrôle. Le middleware existe mais n'est monté nulle part depuis le commit
`06445bd` (« temp: désactivation middleware auth », mars 2024).

**Démontré par** : `tests/unit/api-gateway.test.js` (requête relayée sans
en-tête `Authorization`), `tests/e2e/01-authentification.spec.js` (solde de
congés, liste de candidats et endpoint de debug accessibles sans jeton).

**Élément à charge** : `tests/unit/middleware-auth.test.js` établit en 7 tests
que le middleware fonctionne correctement, y compris sur les jetons expirés —
le motif invoqué pour le désactiver était erroné.

- [ ] Corrigé — remonter le middleware sur toutes les routes `/api` sauf `/api/auth/login`

---

### VULN-06 — Endpoint de debug exposant les données RH · **Critique · RGPD**

`services/conges/src/app.js:32` — `GET /conges/debug/all` effectue un
`SELECT * FROM conges JOIN employees` sans authentification, sans filtre et sans
pagination. Sortent notamment les **salaires** et les **motifs d'absence**
(données de santé au sens du RGPD).

Ajouté en octobre 2023 (`5997936`) avec le commentaire « TODO: sécuriser ou
supprimer avant la prochaine mise en prod ». Toujours en place 21 mois plus tard.

**Démontré par** : `tests/unit/conges.test.js`,
`tests/integration/conges.integration.test.js`, `tests/e2e/01-authentification.spec.js`.

- [ ] Corrigé — supprimer la route

---

### VULN-07 — Upload de fichier sans aucun contrôle · **Élevé**

`services/recrutement/src/app.js:9` — multer conserve `file.originalname` comme
nom de fichier, sans filtre de type (`fileFilter`) ni limite de taille
(`limits`).

Trois conséquences, toutes démontrées :

| Effet | Test |
|---|---|
| un `.php` est écrit tel quel sur le disque | unit + intégration + E2E |
| deux candidats envoyant `cv.pdf` écrasent le même fichier — le premier CV est perdu | `tests/integration/recrutement.integration.test.js` |
| 5 Mo passent sans être refusés | `tests/unit/recrutement.test.js` |

- [ ] Corrigé — `fileFilter` sur le type MIME, `limits.fileSize`, nom de fichier généré côté serveur

---

### VULN-08 — Données de candidats accessibles sans authentification · **Élevé**

`GET /recrutement/candidats` renvoie l'intégralité de la table (emails, postes,
chemins des CV), sans jeton, sans `LIMIT`.

**Démontré par** : `tests/unit/recrutement.test.js`, `tests/e2e/04-candidature.spec.js`.

- [ ] Corrigé — authentification + pagination

---

### VULN-09 — CORS totalement ouvert · **Moyen**

`services/api-gateway/src/app.js:15` — `Access-Control-Allow-Origin`,
`-Methods` et `-Headers` à `*`. Commentaire d'origine : « à restreindre en prod
(TODO) ».

**Démontré par** : `tests/unit/api-gateway.test.js`, `tests/e2e/01-authentification.spec.js`.
Marqué `FAIL` dans `.zap-rules.tsv` : ce constat fait échouer le stage Security.

- [x] **Corrigé (19/08)** — CORS restreint à une liste blanche d'origines ; le test asserte le refus d'une origine non autorisée (`api-gateway.test.js`, `00-passerelle.spec.js`).

---

### VULN-10 — Trace d'exécution renvoyée au client · **Moyen**

`services/api-gateway/src/app.js` — le gestionnaire d'erreurs renvoie
`{ error, stack }`. La pile expose l'arborescence du serveur et les versions des
dépendances.

**Démontré par** : `tests/unit/api-gateway.test.js`. Marqué `FAIL` dans
`.zap-rules.tsv`.

- [ ] Corrigé — message générique en production, trace envoyée aux journaux uniquement

---

### VULN-11 — nginx expose les journaux applicatifs en libre accès · **Critique · RGPD**

`nginx/hrflow.conf:8`

```nginx
location /logs/ {
    alias /var/log/hrflow/;
    autoindex on;
}
```

Le répertoire des journaux est servi publiquement, **avec listing de répertoire
activé**, sur le même hôte que l'application et sans aucune authentification.

Ce que contiennent ces journaux, d'après le code :

| Source | Contenu divulgué |
|---|---|
| `services/auth/src/app.js:24` | `[AUTH] Login: <email> role=<role>` — annuaire des comptes et de leurs privilèges |
| `services/*/src/server.js` | `JWT_SECRET: <valeur>` journalisé à chaque démarrage |
| `services/api-gateway/src/app.js` | traces d'exécution complètes (VULN-10) |

Autrement dit : le secret de signature des jetons est récupérable par une simple
requête HTTP anonyme. Combiné à VULN-05 (aucune authentification), cela permet
de forger un jeton de rôle `rh` sans jamais toucher à la base.

**Non couvert par un test automatisé** : nginx est de l'infrastructure, hors
périmètre de Jest et de Playwright. Le scan ZAP ne l'atteint pas non plus,
puisqu'il vise directement la passerelle sur le port 3000 et non nginx.
Constat issu de la relecture du fichier, à traiter dans la remédiation
d'infrastructure (L1 / L3).

- [ ] Corrigé — supprimer le bloc `location /logs/`, cesser de journaliser
      secrets et adresses email, centraliser les journaux (L4)

---

## Défauts fonctionnels

### BUG-01 — Déni de service par une seule requête publique · **Critique**

> Sévérité relevée d'« Élevé » à **Critique** le 23/07, après exécution des
> tests E2E sur des services réellement démarrés.

`services/paie/src/app.js:53` — `emp.rows[0].salaire_mensuel_brut` sans
vérification. Sur un employé inexistant, `emp.rows[0]` vaut `undefined` et la
TypeError remonte dans un handler `async` qu'Express 4 n'intercepte pas.

**Ce n'est pas seulement une requête sans réponse : le processus du service
s'arrête.** Depuis Node 15, un rejet de promesse non géré est traité comme une
exception fatale. Mesuré en conditions réelles :

```
1. service vivant      : HTTP 200
2. employé inexistant  : ERREUR ECONNRESET
   >>> LE PROCESSUS S'EST ARRETE — code=1
3. service encore là ? : ERREUR ECONNREFUSED
```

La route est **publique** (VULN-05 : aucune authentification nulle part). Une
seule requête anonyme, sans jeton, coupe la paie de toute l'entreprise. Rien ne
relance le processus : ni superviseur, ni politique de redémarrage.

C'est le mécanisme le plus probable de l'**incident P1 du 14-15 août 2024** :
une erreur non gérée en pleine nuit, aucun processus survivant, et personne
d'alerté avant l'appel client à 2 h 15.

Origine : régression d'avril 2024, commit `6da2822` « fix(paie): calcul heures
supplémentaires manquant » — le correctif a ajouté la fonctionnalité sans
traiter le cas d'absence.

**Démontré par** : `tests/e2e/06-deni-de-service.spec.js` (4 étapes : service
vivant → requête → processus arrêté en code 1 → service définitivement
injoignable, sur une instance isolée pour ne pas perturber les autres
parcours), `tests/unit/paie.test.js`, `tests/integration/paie.integration.test.js`.

Un nombre d'heures négatif produit par ailleurs une majoration négative.

- [ ] Corrigé — garde sur `rows.length`, validation de `heures`, wrapper async

---

### BUG-12 — L'API Gateway ne route rien · **Critique**

> Découvert le 23/07 par les tests E2E. Invisible en test unitaire : celui-ci
> remplace `http-proxy-middleware` par un double.

`services/api-gateway/src/app.js` — les proxys transmettent le chemin d'origine
**sans retirer le préfixe de montage** :

```js
app.use('/api/auth', createProxyMiddleware({ target: 'http://localhost:3001' }))
```

Le service auth reçoit `POST /api/auth/login`, alors que sa seule route est
`POST /auth/login`. **Aucun service n'expose de route sous `/api/`.** Résultat :
404 sur la totalité de `/api/*`.

Rien ne compense en amont : `nginx/hrflow.conf` fait un simple
`location / { proxy_pass http://localhost:3000; }`, sans réécriture.

Portée : **toute l'API est injoignable par son point d'entrée public**. Le
frontend appelle `http://localhost:3000/api/auth/login`
(`frontend/src/components/Login.jsx:14`) — il n'a jamais pu fonctionner.

Mesuré :

| Appel | Résultat |
|---|---|
| `POST http://localhost:3000/api/auth/login` (passerelle) | **404** |
| `POST http://localhost:3001/auth/login` (service direct) | **200** + jeton |

**Démontré par** : `tests/e2e/00-passerelle.spec.js` (6 tests). C'est la raison
pour laquelle les parcours 1 à 5 s'adressent aux services directement — voir
`tests/e2e/cibles.js`.

- [ ] Corrigé — une option par proxy :
      `createProxyMiddleware({ target, changeOrigin: true, pathRewrite: { '^/api': '' } })`
      puis repasser les parcours E2E sur la passerelle

---

### BUG-02 — Échec de versement Stripe silencieux · **Critique métier**

`services/paie/src/app.js:26` — le `catch` journalise et poursuit. L'API répond
200 avec le bulletin : le salarié a un bulletin, pas son argent, et rien dans la
réponse ne permet de le savoir.

**Démontré par** : unit, intégration (le bulletin est persisté malgré l'échec)
et E2E (l'appel sortant est rendu impossible, l'API répond quand même 200).

- [ ] Corrigé — statut de versement persisté, réponse explicite, reprise sur échec

---

### BUG-03 — Congés en attente non déduits du solde · **Élevé**

`services/conges/src/app.js:15` — `joursEnAttente` est calculé puis renvoyé,
mais le solde vaut `joursAcquis - joursPris`. Un salarié ayant 25 jours acquis,
5 pris et 3 en attente voit **20 jours disponibles** au lieu de 17, et rien ne
l'empêche de reposer les mêmes jours.

**Démontré par** : unit, intégration, et E2E (10 jours demandés, solde affiché
inchangé ; deux demandes identiques acceptées).

- [ ] Corrigé — `solde = joursAcquis - joursPris - joursEnAttente`, détection de chevauchement

---

### BUG-04 — Montants de paie non arrondis · **Moyen**

Calcul en virgule flottante sur des euros. Pour 2 333,33 € brut, le bulletin
porte 979,9985999999999 € de cotisations patronales.

**Démontré par** : `tests/unit/paie.test.js`.

Défaut connexe visible uniquement en intégration : `pg` renvoie les colonnes
`NUMERIC` sous forme de **chaîne**. Le `brut` du bulletin est donc une chaîne
(`'3000.00'`) alors que le net est un nombre.

- [ ] Corrigé — calcul en centimes entiers, ou bibliothèque décimale

---

### BUG-05 — Aucun contrôle d'unicité ni de validité sur les bulletins · **Moyen**

`mois: 99, annee: -1` est accepté. Deux appels successifs produisent deux
bulletins et **deux versements Stripe** pour le même mois.

**Démontré par** : unit, intégration (2 lignes en base, 2 appels Stripe), E2E.

- [ ] Corrigé — validation des bornes + contrainte d'unicité `(employee_id, mois, annee)`

---

### BUG-06 — Erreurs asynchrones non gérées · **Critique · transverse**

> Sévérité relevée d'« Élevé » à **Critique** le 23/07 : voir BUG-01, la
> conséquence n'est pas une requête pendante mais **l'arrêt du processus**.

Aucun des 5 services n'enveloppe ses handlers `async`. Express 4 n'intercepte
pas les promesses rejetées, et Node ≥ 15 traite un rejet non géré comme une
exception fatale : **le service s'arrête**.

Toute erreur base de données produit donc le même effet qu'un déni de service :
identifiant non numérique dans une URL, violation de clé étrangère, base
momentanément injoignable. Les 5 services sont concernés.

**Démontré par** : `tests/unit/auth.test.js`, `tests/unit/paie.test.js`,
`tests/integration/conges.integration.test.js` (identifiant non numérique et
violation de clé étrangère : la base protège l'intégrité, l'application ne
traduit pas l'erreur).

- [ ] Corrigé — `express-async-errors` ou wrapper, + gestionnaire d'erreurs par service

---

### BUG-07 — Solde de congés fantôme · **Moyen**

`services/conges/src/app.js:12` — `employee.rows[0]?.jours_conges_acquis || 25`.
Deux effets :

- un employé **inexistant** reçoit un solde de 25 jours au lieu d'un 404 ;
- un employé ayant réellement **0 jour acquis** en reçoit 25 (`0` est *falsy*).

**Démontré par** : `tests/unit/conges.test.js`, `tests/integration/conges.integration.test.js`.

- [ ] Corrigé — 404 si l'employé est absent, `??` au lieu de `||`

---

### BUG-08 — Aucune validation des dates de congés · **Moyen**

Période inversée acceptée (−10 jours enregistrés en base), date invalide
enregistrée avec `nombre_jours = NaN`, demande de 364 jours acceptée sans
contrôle de solde. Une journée posée compte 0 jour (différence de dates sans
borne incluse).

**Démontré par** : `tests/unit/conges.test.js`, intégration, E2E.

- [ ] Corrigé — validation des dates, bornes incluses, contrôle du solde disponible

---

### BUG-09 — Mise à jour de statut non vérifiée · **Faible**

`services/recrutement/src/app.js:29` — `rowCount` n'est jamais consulté :
`{success: true}` est renvoyé même pour un identifiant inexistant. N'importe
quelle valeur de statut est acceptée, y compris `undefined`.

**Démontré par** : unit, intégration, E2E.

- [ ] Corrigé — 404 si `rowCount === 0`, liste blanche de statuts

---

### BUG-10 — Sonde de santé creuse · **Moyen · bloquant pour le L3**

`GET /health` renvoie `{status: 'ok'}` sans vérifier ni la base ni les services
amont. Une sonde qui ne peut pas échouer rendra **le Blue/Green du L3 aveugle** :
un déploiement défaillant sera déclaré sain.

**Démontré par** : `tests/unit/api-gateway.test.js`.

- [ ] Corrigé — vérification de la base et des services amont, distinction `/health` (liveness) et `/ready` (readiness)

---

### BUG-11 — Comportement incohérent en l'absence de `JWT_SECRET` · **Faible**

Le service Auth retombe sur un secret codé en dur ; le middleware de la
passerelle, lui, n'a aucun repli et rejette tout. Deux composants d'une même
chaîne, deux comportements opposés face à la même configuration manquante.

**Démontré par** : `tests/unit/middleware-auth.test.js`.

- [ ] Corrigé — échec explicite au démarrage des deux côtés

---

## Récapitulatif

| Sévérité | Vulnérabilités | Défauts fonctionnels | Total |
|---|---|---|---|
| Critique | 6 | 4 | **10** |
| Élevé | 3 | 1 | **4** |
| Moyen | 2 | 5 | **7** |
| Faible | 0 | 2 | **2** |
| **Total** | **11** | **12** | **23** |

Les défauts BUG-06 et VULN-05 sont **transverses** : ils affectent les 5 services.

## État de la remédiation (au 19/08/2026)

La remédiation est menée au fil du J3 par Anna. À date, **3 défauts corrigés, 20
ouverts**. Chaque correction s'accompagne de la réécriture du test constatant le
défaut en test de non-régression — la suite reste verte.

### Corrigés et vérifiés

| Défaut | Correction | Preuve |
|---|---|---|
| **VULN-02** — secret JWT en dur | repli codé en dur supprimé | plus aucune occurrence du secret dans `auth/src/app.js` |
| **VULN-03** — clé Stripe en dur | clé `sk_live_` supprimée, aucun appel sans `STRIPE_SECRET_KEY` | test `SECURITY` dans `paie.test.js` |
| **VULN-09** — CORS ouvert | liste blanche d'origines | tests « VULN-09 corrigée » dans `api-gateway.test.js` et `00-passerelle.spec.js` |

### Durcissement ajouté (au-delà des 23 défauts catalogués)

- en-têtes de sécurité sur les réponses API : **CSP** (`default-src 'none'`) et **`Cache-Control: no-store`** ;
- erreurs **404 renvoyées en JSON** (et non en HTML Express) ;
- images Docker : **CVE corrigées** (montée de `multer` en 2.x, image nginx à jour) ;
- **feature flag** sur la route recrutement (`FEATURE_RECRUITMENT_ENABLED`).

> Note : la montée de `multer` en 2.x corrige la **CVE de la dépendance**, mais
> **VULN-07 reste ouverte** — l'upload n'a toujours ni `fileFilter` ni `limits`,
> et le test continue de le constater.

### Toujours ouverts — 20 défauts

Tous les autres, dont les plus graves : **VULN-01** (injection SQL), **VULN-05**
(aucune authentification sur la passerelle), **VULN-06** (endpoint de debug RH),
**VULN-11** (journaux exposés par nginx), **BUG-01** (déni de service), **BUG-12**
(la passerelle ne route rien). Ils restent constatés par des tests verts —
c'est-à-dire prêts à basculer en non-régression dès qu'ils seront corrigés.

### Les trois défauts découverts par l'exécution réelle

Ces trois-là étaient **invisibles en test unitaire**. Ils justifient à eux seuls
les niveaux intégration et E2E de la pyramide :

| Défaut | Pourquoi le test unitaire ne pouvait pas le voir |
|---|---|
| **BUG-01** (arrêt du processus) | un test unitaire appelle le handler en mémoire ; il n'y a pas de processus à tuer |
| **BUG-12** (passerelle qui ne route rien) | le test unitaire remplace `http-proxy-middleware` par un double — c'est justement le vrai composant qui est en cause |
| **BUG-04 bis** (`NUMERIC` renvoyé en chaîne) | dépend du pilote `pg` face à un vrai PostgreSQL, jamais d'un mock |

### Chaîne d'attaque complète, sans aucun identifiant

En combinant quatre défauts, un attaquant anonyme obtient un accès administratif :

1. **VULN-11** — `GET /logs/` livre `JWT_SECRET` en clair ;
2. **VULN-02** — ce secret signe les jetons ; il permet d'en forger un de rôle `rh` ;
3. **VULN-05** — de toute façon, aucun service ne vérifie de jeton ;
4. **VULN-06** — `GET /conges/debug/all` livre salaires et motifs d'absence.

Et s'il préfère nuire plutôt qu'exfiltrer, **BUG-01** coupe la paie en une requête.
