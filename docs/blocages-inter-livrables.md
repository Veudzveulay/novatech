# Blocages du livrable L2 — ce qui dépend des autres livrables

> Établi le 23/07/2026 à la fin des travaux du L2.
> **Mis à jour le 23/07 après réception du livrable L1.**
> Chaque entrée précise : ce qui est bloqué, par quoi, ce qui a été livré
> malgré tout, et la **condition exacte de levée**.

---

## Synthèse

| # | Sujet | Bloqué par | Statut du L2 |
|---|---|---|---|
| B-01 | Scan Trivy des images Docker | **L1** — Dockerfiles non fonctionnels | job écrit et réaligné, toujours `if: false` |
| B-02 | Stage Security vert | **remédiation** — secrets et dépendances | stage livré et bloquant, **rouge par construction** |
| B-03 | Fusion dans le pipeline unique | ~~L1~~ **levé** | patch fourni, `docs/integration-pipeline-l1.md` |
| B-04 | Tests d'interface (E2E navigateur) | **frontend non démarrable** | E2E de niveau API livrés à la place |
| B-05 | Jeux de données réalistes | **Théo Marchand** — export staging | jeu synthétique livré |
| B-06 | Validation du schéma SQL | **Théo Marchand** — schéma de production | schéma reconstitué livré |
| B-07 | Version de Node du projet | ~~L1~~ **levé** | Node 20 des deux côtés |
| B-08 | Le service `auth` est absent du L1 | **L1** — architecture | **nouveau**, bloquant pour le scan d'images |

---

## Décisions prises le 23/07

### D1 · Le service `auth` reste une unité déployable à part entière

**Alternative écartée** : fusionner `auth` dans `api-gateway`, comme le suppose
`docs/01-architecture-pipeline.md` § 2 du L1.

Trois raisons :

1. **Le coût et le risque.** Fusionner, c'est refondre au J2 le service qui
   porte l'injection SQL et le secret JWT en dur — sans avoir corrigé ni l'un ni
   l'autre. Garder la séparation, c'est un Dockerfile et deux lignes de matrice.
2. **Ça contredit la justification du L1 lui-même.** Le L1 défend les images par
   service pour permettre un rollback ciblé (« rollback `service-paie` seul »).
   Fusionner l'auth dans la passerelle impose de redéployer le point d'entrée de
   toute la plateforme à chaque correctif d'authentification — l'inverse de
   l'objectif affiché.
3. **La soutenance.** « Pourquoi avoir fusionné le service d'authentification
   pendant un projet de 5 jours ? » est une mauvaise question à devoir traiter.
   « Nous avons conservé la frontière existante et corrigé la documentation
   d'architecture » est défendable en une phrase.

**Ce que ça implique** : 6 unités déployables, donc 6 tâches ECS en staging et
6 en production au J3. À intégrer dans le garde-fou budget AWS (Fargate Spot,
`terraform destroy` quotidien).

**Corollaire** : `docs/01-architecture-pipeline.md` § 2 est factuellement faux
sur ce point et doit être corrigé — le tableau des unités et le rôle attribué à
`api-gateway`.

### D2 · Nomenclature : les noms réels des dossiers

`front`, `api-gateway`, `auth`, `paie`, `conges`, `recrutement`. On renomme la
matrice du L1 et les dossiers `docker/`, pas les dossiers du dépôt : renommer
`services/paie` en `services/service-paie` casserait les chemins des 162 tests,
les `require()` internes et la lisibilité de l'historique Git.

### D3 · Workspaces npm conservés

**Alternative écartée** : revenir à un `package-lock.json` par service, comme le
supposent les Dockerfiles et le `cache-dependency-path` du L1.

1. **Un seul lockfile = un seul `npm audit`.** C'est ma porte de sécurité. Avec
   5 lockfiles, il faut 5 exécutions, et la dérive de versions entre services
   devient invisible.
2. **Un seul `npm ci` à la racine** installe les 5 services *et* l'outillage de
   test. Les 3 jobs du Stage 2 en dépendent.
3. **L'argument « le L1 marche déjà comme ça » ne tient pas** : les Dockerfiles
   ne construisent pas du tout aujourd'hui, ils doivent être réécrits de toute
   façon. Autant les écrire une fois, correctement.

Le surcoût est de ~6 lignes par Dockerfile
(`npm ci --workspace=... --include-workspace-root`), fournies dans
[`docs/integration-pipeline-l1.md`](integration-pipeline-l1.md) § 3.2.

### D4 · Le stage Security reste rouge, sans exception — mais n'est pas encore requis au merge

Le piège de « le laisser rouge » : si le Stage 3 est un **statut requis** dans
la protection de branche, plus aucune PR ne peut être mergée, et les L3 et L4
sont à l'arrêt.

La sortie n'est pas d'ajouter des tolérances dans `.gitleaks.toml` ou
`.zap-rules.tsv` — ça masque le problème dans un fichier que personne ne relit.
Elle est de **séparer « le stage échoue » de « le merge est bloqué »** :

- le Stage 3 tourne à chaque PR, échoue visiblement, et son rapport est publié ;
- les statuts **requis** au merge sont, jusqu'au J3 : Stage 1 (Build) et
  Stage 2 (Tests) ;
- **le Stage 3 devient requis dès que la remédiation est passée** — l'exception
  est alors visible dans les réglages GitHub, datée, et réversible d'un clic.

**Ce qu'il faut corriger pour le passer au vert** — environ 2 h de travail, rien
d'exotique :

| Cause du rouge | Correction | Qui |
|---|---|---|
| `.env` dans l'arbre et l'historique | purge + bascule en secrets GitHub | Dev 1 — déjà « amorce J+1 » du J2 |
| `jsonwebtoken@8.5.1` (High) | montée en `^9.0.2` — l'API `sign`/`verify` utilisée ici est compatible | remédiation |
| `bcrypt@5.1.0` → `tar` (Critical) | montée en `^5.1.1` | remédiation |
| CORS ouvert (VULN-09) | liste blanche d'origines — 3 lignes | remédiation |
| Trace d'exécution renvoyée (VULN-10) | message générique en production — 3 lignes | remédiation |

**Échéance proposée : Stage 3 vert et requis à la fin du J3.** Au-delà, c'est le
J4 et le J5 qui absorbent le retard, et la démonstration se fait sur un pipeline
qui n'a jamais été entièrement vert.

---

### Ce que la réception du L1 a changé

| Blocage | Avant | Après réception du L1 |
|---|---|---|
| B-03 fusion pipeline | en attente du workflow principal | **levé** — `ci.yml` reçu, patch d'intégration écrit |
| B-07 version de Node | divergence 16 / 20 possible | **levé** — le L1 est en Node 20, comme le L2 |
| B-01 scan d'images | aucun Dockerfile | **toujours bloqué** — les Dockerfiles existent mais ne construisent pas |
| B-08 service `auth` | — | **nouveau blocage**, le plus gênant des trois |

---

## B-01 — Scan Trivy des images Docker · toujours bloqué

**Mise à jour du 23/07** : les Dockerfiles du L1 sont arrivés
(`docker/<unité>/Dockerfile`, 5 unités, multi-stage, utilisateur non-root,
Node 20). Le job `trivy-images` a été **réaligné sur leur nomenclature et leurs
chemins**. Il reste désactivé : ces Dockerfiles ne construisent pas contre ce
dépôt.

`docker build --target prod ./docker/api-gateway` échoue à la 4ᵉ instruction.
Quatre causes, détaillées avec les correctifs proposés dans
[`docs/integration-pipeline-l1.md`](integration-pipeline-l1.md) § 3.2 :

1. le contexte de build (`./docker/<unité>`) ne contient que le Dockerfile —
   `COPY package.json package-lock.json ./` n'a rien à copier ;
2. `npm run lint`, `npm run typecheck` et `npm run build` n'existent dans aucun
   `package.json` du dépôt ;
3. `CMD ["node", "dist/index.js"]` — il n'y a pas de `dist/`, le point d'entrée
   est `src/server.js` ;
4. les Dockerfiles attendent un `package-lock.json` par service, alors que le L2
   a introduit des workspaces npm (un seul lock à la racine).

**Livré malgré tout** : le scan `trivy fs` (dépendances, configurations,
secrets) tourne déjà et est bloquant.

**Condition de levée** : `docker build --target prod` passe en local pour au
moins une unité → retirer le `if: false`. La matrice est déjà à jour.

---

## B-02 — Le stage Security est rouge par construction

**Ce n'est pas un défaut du livrable : c'est son résultat.**

Le stage Security est bloquant, comme demandé. Il échoue aujourd'hui sur des
constats réels, qu'il serait malhonnête de masquer :

| Contrôle | Constat | Qui doit trancher |
|---|---|---|
| gitleaks | `.env` commité (`24b295b`) : mot de passe de production, secret JWT, clés AWS, clé Stripe `sk_live_`, clé SendGrid, identifiants SMTP — présents dans le fichier **et dans l'historique** | purge de l'historique — tâche « Amorce J+1 » du J2 |
| npm audit | 1 vulnérabilité critique (`tar`, via `bcrypt` → `node-pre-gyp`) et 3 élevées en dépendances de production, dont `jsonwebtoken@8.5.1` | montée de version — plan de remédiation |
| ZAP baseline | CORS ouvert (VULN-09) et divulgation de trace (VULN-10), marqués `FAIL` dans `.zap-rules.tsv` | correction applicative — plan de remédiation |

**Aucune exception n'a été ajoutée pour verdir artificiellement le stage.**
`.gitleaks.toml` n'exempte que les fixtures de test créées au J2 ;
`.zap-rules.tsv` documente chaque tolérance avec sa justification.

**Décision demandée à l'équipe** (à porter au point de 17 h) : accepte-t-on un
stage Security rouge jusqu'à la purge des secrets, ou introduit-on une
tolérance datée et nominative ? Recommandation : **le laisser rouge**. Un
pipeline vert qui laisse fuiter des identifiants de production est exactement
ce que ce projet est censé corriger, et le jury lira l'historique.

**Attention si des tolérances sont introduites** : les tests unitaires et E2E,
eux, resteront verts. Ils constatent les vulnérabilités, ils ne les jugent pas.

---

## B-03 — Fusion dans le pipeline unique · **levé**

Le `ci.yml` du L1 est arrivé. Il livre le Stage 1 et prévoit explicitement
d'accueillir les stages Test et Security « dans ce même fichier au fil des
livrables J2/J3 ».

Les deux workflows du L2 exposent `on: workflow_call` : rien à recopier, il
suffit de les appeler. **Le patch exact est fourni dans
[`docs/integration-pipeline-l1.md`](integration-pipeline-l1.md) § 1.**

Deux pièges signalés dans ce patch :
- les permissions ne s'héritent pas — sans `pull-requests: write` sur le job
  appelant, le commentaire de couverture échoue en silence, job vert ;
- si le job récapitulatif est renommé, il faut mettre à jour la règle de
  protection de branche, sinon elle pointe vers un statut inexistant et
  **toute PR redevient mergeable**.

Ajustement déjà fait côté L2 : déclenchement aligné sur Trunk-Based (PR vers
`main` uniquement, `dev` retiré des deux workflows).

---

## B-04 — Aucun test d'interface · frontend non démarrable

**Constat**, dans `frontend/` :

- `package.json` invoque `react-scripts start` / `build` / `test`, mais
  **`react-scripts` n'est dans aucune dépendance** ;
- il n'y a **ni `public/index.html`, ni `src/index.js`** — pas de point d'entrée ;
- seuls existent `components/Login.jsx` et `pages/Dashboard.jsx` ;
- `src/__tests__/login.test.js` ne contient que deux `expect(true).toBe(true)`,
  avec le commentaire « test vide pour ne pas casser la CI ».

**Livré à la place** : 7 parcours Playwright de niveau API (41 tests), sur la
passerelle, les 4 services et une base réelle. Le niveau de preuve reste élevé,
mais **le rendu et les interactions ne sont pas couverts**.

**Ce que ça coûte** : la démonstration en soutenance passera par des appels API,
pas par une interface. À anticiper dans le scénario de démonstration du J5.

**Condition de levée** : un frontend démarrable. C'est une décision d'équipe —
personne n'en a la charge dans la répartition actuelle.

**Recommandation immédiate** : supprimer `frontend/src/__tests__/login.test.js`.
Un test qui assert `true === true` produit une fausse impression de couverture.
Non fait ici : le fichier appartient au périmètre frontend, à trancher au daily.

---

## B-05 — Jeux de données synthétiques · en attente de Théo Marchand

Le plan de tests prévoyait des jeux de données « issus de l'export staging ».
**Aucun accès n'a été fourni.** Les données de `db/seed-test.sql` sont
synthétiques, construites depuis les cas limites du code.

**Conséquence** : la suite ne dit rien du volume réel, des valeurs aberrantes
historiques ni des performances.

**Question posée** : voir `docs/questions-theo-marchand.md`, question n° 2.

---

## B-06 — Schéma SQL reconstitué · à faire valider

`db/schema.sql` a été écrit par **rétro-ingénierie des requêtes** des 4 services :
aucun schéma, aucune migration et aucun seed n'existaient dans le dépôt.

Il décrit ce que le **code attend**, pas nécessairement ce qui **tourne en
production**. Les écarts possibles portent sur les types exacts, les contraintes,
les index et les colonnes non utilisées par le code.

**Impact si le schéma réel diffère** : les tests d'intégration valident le code
contre une base qui n'est pas celle de production — leur pouvoir de détection
en serait réduit.

**Question posée** : voir `docs/questions-theo-marchand.md`, question n° 1.

---

## B-07 — Version de Node · **levé**

Le L1 utilise Node 20 dans son `ci.yml` et `ARG NODE_VERSION=20-alpine` dans
tous ses Dockerfiles. Le L2 était déjà en 20. **Le projet est aligné**, seul le
`deploy.yml` historique (Node 16) reste à supprimer avec l'ancien pipeline.

**Reste à faire, sans urgence** : Playwright est épinglé à 1.44.1, dernière
version compatible avec le Node 16 encore installé sur le poste de dev. Une fois
les postes passés en 20, monter Playwright — la version épinglée porte une
vulnérabilité de niveau élevé (téléchargement de navigateurs sans vérification
du certificat), sans effet ici puisque aucun navigateur n'est téléchargé, mais
qui fait du bruit dans `npm audit`.

---

## B-08 — Le service `auth` est absent du livrable L1 · **nouveau, bloquant**

`docs/01-architecture-pipeline.md` § 2 recense **5 unités déployables** et
attribue l'authentification à la passerelle (« `api-gateway` — Point d'entrée
API, auth, routage »).

Ce n'est pas ce que contient le dépôt. `services/auth/` est un **service
autonome** : son propre `package.json`, son propre pool PostgreSQL, son écoute
sur le port 3001. La passerelle ne fait que lui proxifier `/api/auth` — elle ne
contient aucune logique d'authentification (le seul middleware qui en porte est
du code mort depuis mars 2024, cf. VULN-05).

**Conséquence** : pas de Dockerfile, pas d'entrée dans la matrice CI, pas
d'image publiée, donc **pas de scan Trivy** — sur le service qui porte
l'injection SQL (VULN-01) et le secret JWT codé en dur (VULN-02), c'est-à-dire
les deux vulnérabilités les plus graves de l'application. En l'état, le service
le plus dangereux du système serait le seul à échapper au pipeline.

**Demande à la personne en charge du L1** : ajouter `auth` comme 6ᵉ unité —
Dockerfile, matrice `lint-and-typecheck`, matrice `docker-build`. La ligne
correspondante est déjà prête et commentée dans la matrice `trivy-images` de
`security.yml`.

**Question ouverte, à trancher en équipe** : le L1 décrit une architecture où
l'authentification est portée par la passerelle. Est-ce une **cible** assumée
(fusionner `auth` dans `api-gateway`) ou une **erreur de lecture** du dépôt ?
Les deux réponses sont défendables, mais elles n'impliquent pas le même travail,
et la réponse change les tests du L2 (`tests/unit/auth.test.js` et
`tests/e2e/01-authentification.spec.js` supposent un service séparé).

---

## Ce qui n'est bloqué par rien et reste à faire

Aucune tâche du L2 n'est en attente pour une autre raison que celles ci-dessus.
