# Couverture de tests — périmètre, exclusions et angles morts

> Livrable **L2** · 23/07/2026
> Ce document répond à la question « qu'est-ce qui n'est pas couvert, et
> pourquoi ? ». Chaque exclusion y est justifiée nommément.

---

## 1. Périmètre mesuré

```js
collectCoverageFrom: [
  'services/*/src/**/*.js',
  '!services/*/src/server.js',
  '!services/*/src/db.js',
]
```

| Seuil | Valeur | Effet |
|---|---|---|
| Statements | 80 % | bloquant en CI |
| Branches | 75 % | bloquant en CI |
| Functions | 80 % | bloquant en CI |
| Lines | 80 % | bloquant en CI |

Mesure au 23/07/2026, **tests unitaires seuls** (les tests d'intégration ne font
qu'augmenter ces chiffres) :

| Métrique | Résultat |
|---|---|
| Statements | 100 % — 133/133 |
| Branches | 92,3 % — 24/26 |
| Functions | 100 % — 18/18 |
| Lines | 100 % — 126/126 |

---

## 2. Fichiers exclus, un par un

### `services/*/src/server.js` — amorçage réseau

**Contenu** : `require('./app')` puis `app.listen(PORT, callback)`.

**Pourquoi exclu** : couvrir ces 4 lignes en Jest imposerait d'ouvrir de vrais
ports pendant les tests unitaires — donc des conflits, de l'attente et de
l'instabilité, pour zéro logique métier vérifiée.

**Comment c'est réellement couvert** : les 7 parcours Playwright démarrent ces
fichiers comme processus. Si un `server.js` est cassé, **aucun E2E ne passe**.
La couverture est assurée par un autre niveau de la pyramide, pas absente.

---

### `services/*/src/db.js` — construction du pool PostgreSQL

**Contenu** : `new Pool({...})` et son export.

**Pourquoi exclu** : en tests unitaires ce module est remplacé par un double
(`jest.mock`) — le vrai fichier n'est jamais exécuté, il apparaîtrait donc
artificiellement à 0 %, ce qui tirerait la mesure globale vers le bas sans
signifier quoi que ce soit.

**Comment c'est réellement couvert** : les tests d'intégration l'exécutent pour
de bon, contre un PostgreSQL réel. Une erreur de configuration du pool fait
échouer l'intégralité de la suite d'intégration.

---

## 3. Les 2 branches non couvertes (7,7 %)

### `services/auth/src/app.js:31` — repli du secret dans `/auth/verify`

```js
jwt.verify(token, process.env.JWT_SECRET || 'novatech_jwt_super_secret_key_2021_do_not_share')
```

Le repli est testé sur `/auth/login` (VULN-02) mais pas sur `/auth/verify`.
**C'est le même défaut, au même fichier, déjà documenté et déjà prouvé.** Ajouter
un second test identique gonflerait le chiffre sans rien apprendre.

### `services/recrutement/src/app.js:10` — repli `process.env.UPLOAD_DIR`

```js
destination: process.env.UPLOAD_DIR || '/tmp/uploads/'
```

La branche `/tmp/uploads/` n'est jamais empruntée : les tests définissent
toujours `UPLOAD_DIR` vers un répertoire temporaire isolé. La couvrir voudrait
dire écrire dans `/tmp/uploads/` sur la machine du développeur — **effet de bord
inacceptable pour un test**.

---

## 4. Angles morts — ce qu'aucun test ne couvre

C'est la partie la plus importante de ce document. Les limites suivantes sont
connues et assumées ; elles ne sont pas des oublis.

| # | Angle mort | Raison | Qui/quand |
|---|---|---|---|
| 1 | **L'interface web** | le frontend n'est pas démarrable : `react-scripts` absent des dépendances, ni `public/index.html`, ni `src/index.js` | à rouvrir si le frontend est réparé |
| 2 | **Le proxy réel** (`http-proxy-middleware`) | remplacé par un double en unitaire ; en E2E il est réellement traversé, mais ses cas d'erreur (timeout amont, service mort) ne sont pas simulés | L3, avec le Blue/Green |
| 3 | **L'intégration Stripe réelle** | jamais appelée : clé `sk_live_` dans le dépôt. Seul le contrat d'appel est vérifié | nécessite un compte Stripe de test — décision équipe |
| 4 | **La performance et la montée en charge** | hors périmètre L2, et le jeu de données est synthétique | non planifié ; à arbitrer si le temps le permet au J4 |
| 5 | **Le fichier `nginx/hrflow.conf`** | configuration d'infrastructure, non testable par Jest | L3 |
| 6 | **`scripts/deploy.sh`** | script de déploiement historique, appelé à disparaître avec le pipeline du L1 | L1/L3 |
| 7 | **Les migrations de schéma** | `db/schema.sql` est reconstitué par rétro-ingénierie, non validé contre la production | à confirmer avec Théo Marchand |
| 8 | **La concurrence** | deux demandes de congés simultanées sur le même solde : aucun test de course | limite reconnue ; le code n'a de toute façon aucun verrou |
| 9 | **Les jeux de données réels** | aucun export de staging fourni | question ouverte n° 1 |

---

## 5. Ce que la couverture ne dit pas

Le code applicatif compte **133 instructions**. Sur une base aussi petite,
atteindre 100 % est facile et **ne prouve rien** : 23 défauts sont documentés
dans un code couvert à 100 %.

- La couverture mesure **ce qui est exécuté**, pas ce qui est **vérifié**.
- Un test sans assertion couvre autant qu'un bon test — c'est précisément ce que
  faisait `frontend/src/__tests__/login.test.js` avec ses `expect(true).toBe(true)`.
- La mesure de qualité réelle de ce livrable est la **liste des scénarios**
  (`docs/plan-de-tests.md` § 5) et la **liste des défauts trouvés**
  (`docs/regressions-detectees.md`).

---

## 6. Règle de maintenance

Aucune exclusion n'est ajoutée à `jest.config.js` sans une entrée
correspondante dans ce fichier, expliquant :

1. ce que contient le fichier exclu ;
2. pourquoi le couvrir n'a pas de sens ;
3. par quel autre moyen le comportement est vérifié.

Une exclusion sans ces trois éléments est un maquillage de la mesure.
