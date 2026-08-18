# Plan de tests — NovaTech HRFlow

> Livrable **L2** · ShipIt BC03 M2 LDF · rédigé le 23/07/2026
> Périmètre : stratégie de test, organisation, jeux de données, critères
> d'acceptation et limites assumées.

---

## 1. Contexte et objectif

Le dépôt reçu de Théo Marchand ne contenait **aucun test exécutable**. Le seul
fichier de test présent (`frontend/src/__tests__/login.test.js`) contient deux
assertions `expect(true).toBe(true)`, avec le commentaire « test vide pour ne
pas casser la CI ». Le pipeline livré (`deploy.yml`) commentait explicitement
l'étape de test : `# Tests désactivés — on n'en a pas encore`.

L'objectif de ce plan n'est donc pas d'améliorer une couverture existante mais
d'en **construire une depuis zéro**, en priorisant ce qui a réellement cassé en
production :

| Incident | Date | Route concernée | Couverture mise en place |
|---|---|---|---|
| Régression du calcul d'heures supplémentaires | avril 2024 | `POST /paie/heures-sup` | 4 tests unitaires + 1 intégration + 1 E2E |
| Incident P1 nocturne | 14–15 août 2024 | chaîne auth → paie | 16 tests unitaires + 5 intégration + 7 E2E |

### Ce que ce plan ne cherche pas à faire

Atteindre un pourcentage. Le seuil de 80 % est une conséquence, pas une cible :
la cible, ce sont les **routes critiques** — celles qui manipulent de l'argent,
des identités ou des données personnelles.

---

## 2. Stratégie : la pyramide retenue

```
                    ┌─────────────────┐
                    │  E2E   41 tests │   Playwright · services réellement
                    │   7 parcours    │   démarrés, PostgreSQL réel
                    └─────────────────┘
              ┌───────────────────────────┐
              │  Intégration   38 tests   │   Jest + Supertest · SQL réellement
              │  4 fichiers               │   exécuté sur PostgreSQL jetable
              └───────────────────────────┘
        ┌─────────────────────────────────────┐
        │      Unitaires      83 tests        │   Jest + Supertest · couche pg
        │      6 fichiers                     │   mockée, aucune infrastructure
        └─────────────────────────────────────┘
```

**Total : 162 tests, tous verts au 23/07/2026.**

| Niveau | Tests | Durée mesurée |
|---|---|---|
| Unitaires | 83 | 4,4 s |
| Intégration | 38 | 3,6 s |
| Unitaires + intégration avec couverture | 121 | 8,3 s |
| E2E | 41 | 11,0 s |

### Pourquoi ces trois niveaux, et ce que chacun attrape

| Niveau | Ce qu'il valide | Ce qu'il ne peut PAS voir | Durée cible |
|---|---|---|---|
| **Unitaire** | logique métier, codes HTTP, calculs, cas limites, contenu exact des requêtes SQL émises | une colonne mal nommée, un type incompatible, une contrainte violée | < 10 s |
| **Intégration** | le SQL réellement accepté par PostgreSQL, les types renvoyés par le pilote `pg`, les contraintes de clés étrangères, l'écriture disque | le routage de la passerelle, la survie des processus | < 60 s |
| **E2E** | le parcours métier sur des services réellement démarrés : routage, cycle de vie des processus, interactions inter-services | rien de plus, mais au prix le plus élevé | < 3 min |

**Règle de placement** : un cas est testé au niveau le plus bas où il est
observable. Le calcul des cotisations est unitaire ; le fait que PostgreSQL
renvoie `NUMERIC` sous forme de chaîne est nécessairement d'intégration ; le
fait qu'une requête publique **tue le processus** ne peut se voir qu'en E2E.

### Ce que la pyramide a rapporté — trois défauts invisibles plus bas

L'argument le plus solide en faveur de ces trois niveaux, c'est ce que chacun a
trouvé et que les autres ne pouvaient pas voir :

| Défaut | Niveau qui l'a trouvé | Pourquoi le niveau inférieur était aveugle |
|---|---|---|
| **BUG-01** — une requête publique arrête le processus du service de paie | E2E | un test unitaire appelle le handler en mémoire : il n'y a pas de processus à tuer |
| **BUG-12** — la passerelle ne route rien, `/api/*` répond 404 | E2E | le test unitaire remplace `http-proxy-middleware` par un double, c'est-à-dire précisément le composant fautif |
| **BUG-04 bis** — `pg` renvoie les `NUMERIC` en chaîne, le bulletin porte un `brut` textuel | Intégration | dépend du pilote face à un vrai PostgreSQL, jamais d'un mock |

Une suite qui se serait arrêtée aux tests unitaires aurait affiché 100 % de
couverture en passant à côté d'un déni de service et d'une API entièrement
injoignable.

### Choix d'outils

| Outil | Version | Justification |
|---|---|---|
| **Jest** | 29 | standard de fait Node, exécution parallèle, couverture native (pas d'outil tiers à câbler), `projects` pour séparer unitaire et intégration |
| **Supertest** | 6 | teste l'application Express **sans ouvrir de port** : pas de conflit, pas d'attente de démarrage |
| **Playwright** | 1.44 | son client `request` permet des parcours API de bout en bout sans navigateur, et gère le démarrage/arrêt des 5 processus (`webServer`) |
| **PostgreSQL 15** conteneurisé | — | base jetable en `tmpfs`, identique en local et en CI |

Alternatives écartées : Mocha/Chai (assemblage à câbler, aucun gain), Cypress
(orienté navigateur, inutile ici puisque le frontend ne démarre pas), Vitest
(l'application est en CommonJS, aucun bénéfice).

---

## 3. Architecture technique de la suite

```
db/
  schema.sql            DDL reconstitué par rétro-ingénierie des requêtes
  seed-test.sql         jeu de données déterministe
tests/
  setup/
    env.js              variables d'environnement de test (jamais le .env du dépôt)
    global-setup.js     applique le schéma avant les tests d'intégration
    silence-console.js  neutralise les journaux, tout en les gardant inspectables
  helpers/db.js         rechargement du jeu de données entre les tests
  unit/                 6 fichiers · 83 tests
  integration/          4 fichiers · 38 tests sur PostgreSQL réel
  e2e/                  7 parcours Playwright + cibles.js
jest.config.js          2 projets (unit / integration) + seuils de couverture
playwright.config.js    démarrage des 5 processus + base
docker-compose.test.yml PostgreSQL jetable
```

### Prérequis rendu nécessaire par le code livré

Les 5 services appelaient `app.listen()` au chargement du module et
n'exportaient rien : **aucun d'eux n'était testable**. Chaque service a donc été
scindé, sans la moindre modification de comportement :

| Fichier | Rôle |
|---|---|
| `src/app.js` | l'application Express, exportée |
| `src/server.js` | l'écoute réseau (le `app.listen` d'origine) |
| `src/db.js` | le pool PostgreSQL, isolé pour être remplaçable en test |

C'est la seule modification apportée au code applicatif par le L2. **Aucun
défaut n'a été corrigé** : la correction relève du plan de remédiation.

### Commandes

```bash
npm test                  # unitaires seuls — filet rapide du développeur (< 10 s)
npm run db:test:up        # démarre le PostgreSQL jetable
npm run test:integration  # tests d'intégration
npm run test:coverage     # unitaires + intégration + rapport de couverture
npm run test:e2e          # les 7 parcours (nécessite la base démarrée)
npm run db:test:down      # arrête et supprime la base
```

---

## 4. Jeux de données

### Origine

**Aucun export de staging n'a été fourni.** Le plan initial prévoyait de partir
d'un export anonymisé ; l'accès n'existe pas à ce jour (question n° 1 pour
Théo Marchand). Les données sont donc **synthétiques**, construites à partir des
cas limites identifiés dans le code, et non d'un volume de production.

Conséquence assumée : cette suite ne dit rien des performances ni des données
aberrantes réellement présentes en base. À réévaluer si un export est fourni.

### Contenu (`db/seed-test.sql`)

| Table | Enregistrement | Cas couvert |
|---|---|---|
| `users` | `rh@novatech.io` (rôle `rh`) | authentification nominale, rôle privilégié |
| `users` | `employe@novatech.io` (rôle `employe`) | ciblage d'un compte par injection SQL |
| `employees` | Alice — 3 000 € brut, 25 j | calcul de paie nominal, solde de congés partiel |
| `employees` | Bob — **0 €** brut, 25 j | division et cotisations à zéro |
| `employees` | Chloé — 2 500 € brut, **5 j** | solde de congés épuisé |
| `conges` | 5 j approuvés + 3 j en attente (Alice) | **BUG-03** : jours en attente non déduits |
| `conges` | 5 j approuvés sur 5 acquis (Chloé) | solde à zéro |
| `candidats` | 2 candidats à dates distinctes | tri `created_at DESC` |

Les mots de passe en clair sont documentés dans le fichier ; les hash sont de
vrais hash bcrypt (coût 10) afin que `bcrypt.compare` soit réellement exercé.

### Isolation

`seed-test.sql` commence par `TRUNCATE ... RESTART IDENTITY CASCADE` et est
rejoué **avant chaque test**. Aucun test ne dépend de l'ordre d'exécution ni de
l'état laissé par un autre.

---

## 5. Scénarios de test

### 5.1 Service Auth — criticité maximale

| # | Scénario | Niveau | Attendu |
|---|---|---|---|
| A1 | Connexion valide | U + I + E2E | 200, JWT signé, profil sans hash |
| A2 | Contenu et durée du jeton | U | `userId`, `role`, `email`, expiration 24 h |
| A3 | Mot de passe erroné | U + I + E2E | 401 |
| A4 | Compte inexistant | U + I + E2E | 401, **message identique** à A3 |
| A5 | Corps de requête vide | U | 401 sans exception |
| A6 | Jeton valide / autre secret / expiré / altéré / absent | U | 200 puis 401 × 4 |
| A7 | **VULN-01** injection SQL | U + I | la charge atteint le moteur, un JWT est délivré |
| A8 | **VULN-02** secret JWT codé en dur | U | le jeton se vérifie avec le secret du dépôt |
| A9 | **BUG-06** erreur base non gérée | U | aucune réponse HTTP émise |

### 5.2 Service Paie — enjeu financier

| # | Scénario | Niveau | Attendu |
|---|---|---|---|
| P1 | Cotisations 22 % / 42 %, net | U + E2E | 660 / 1 260 / 2 340 pour 3 000 € |
| P2 | Persistance du bulletin | U + I | ligne en base, requête paramétrée |
| P3 | Employé inexistant | U + I + E2E | 404, aucune insertion, aucun versement |
| P4 | Salaire nul | U + I | bulletin à zéro, pas d'erreur |
| P5 | Versement Stripe | U | payout du net en centimes, en euros |
| P6 | **BUG-02** échec du versement | U + I + E2E | 200 malgré l'échec, aucune trace |
| P7 | **VULN-03** clé Stripe codée en dur | U | `sk_live_...` utilisée par défaut |
| P8 | **BUG-04** montants non arrondis | U | 979,9985999999999 € de cotisations patronales |
| P9 | **BUG-05** doublon de bulletin | U + I + E2E | 2 bulletins, 2 versements, même mois |
| P10 | Heures supplémentaires × 1,25 | U + I + E2E | 247,25 € pour 10 h à 3 000 € |
| P11 | **BUG-01** heures-sup, employé absent | U + I + E2E | plantage, aucune réponse |
| P12 | **VULN-04** route de migration ouverte | U + I + E2E | DDL exécuté sans authentification |

### 5.3 Service Congés — fonctionnalité la plus utilisée

| # | Scénario | Niveau | Attendu |
|---|---|---|---|
| C1 | Calcul du solde | U + I + E2E | `solde = acquis − pris` |
| C2 | Agrégation de plusieurs demandes | U | somme correcte |
| C3 | Seuls les congés « approuve » comptent | I | un congé refusé n'est pas décompté |
| C4 | Requêtes paramétrées | U | contre-épreuve de VULN-01 |
| C5 | **BUG-03** jours en attente non déduits | U + I + E2E | solde inchangé après demande |
| C6 | **BUG-07** employé inexistant | U + I | 25 jours au lieu d'un 404 |
| C7 | **BUG-07** 0 jour acquis devient 25 | U | test de vérité au lieu de nullité |
| C8 | Création d'une demande | U + I + E2E | statut `en_attente`, jours calculés |
| C9 | **BUG-08** période inversée | U + I + E2E | −10 jours enregistrés |
| C10 | **BUG-08** date invalide | U | `NaN` inséré |
| C11 | **VULN-06** endpoint de debug | U + I + E2E | salaires et motifs exposés sans jeton |

### 5.4 Service Recrutement

| # | Scénario | Niveau | Attendu |
|---|---|---|---|
| R1 | Dépôt avec CV | U + I + E2E | ligne en base, fichier sur disque |
| R2 | Dépôt sans CV | U | accepté, chemin indéfini |
| R3 | **VULN-07** type de fichier non filtré | U + I + E2E | `.php` accepté et écrit |
| R4 | **VULN-07** écrasement de fichier | I | deux « cv.pdf » → un seul fichier |
| R5 | **VULN-07** aucune limite de taille | U | 5 Mo acceptés |
| R6 | Liste triée par date décroissante | U + I + E2E | plus récent en tête |
| R7 | **VULN-08** liste accessible sans jeton | U + E2E | 200 avec emails et chemins de CV |
| R8 | Changement de statut | U + I + E2E | mise à jour effective |
| R9 | **BUG-09** identifiant inexistant | U + I + E2E | `success: true` sans modification |

### 5.5 API Gateway

| # | Scénario | Niveau | Attendu |
|---|---|---|---|
| G1 | `/health` | U + E2E | 200 `{status: ok}` |
| G2 | **BUG-10** sonde creuse | U | aucune dépendance vérifiée |
| G3 | Routage vers les 4 services | U | cibles correctes, `changeOrigin` |
| G4 | Cibles configurables par variables | U | prérequis du docker-compose L1 |
| G5 | **VULN-05** aucune route protégée | U + E2E | relayé sans `Authorization` |
| G6 | **VULN-09** CORS ouvert | U + E2E | `*` sur origine, méthodes, en-têtes |
| G7 | **VULN-10** trace d'exécution renvoyée | U | `stack` dans le corps de la réponse |

### 5.6 Middleware d'authentification — contre-expertise

Le middleware `services/api-gateway/src/middleware/auth.js` est du code mort
depuis le commit `06445bd` (« temp: désactivation middleware auth », mars 2024),
dont le message invoque « un bug de token expiration ».

**7 tests unitaires établissent que ce bug n'existe pas** : jeton valide, jeton
absent, jeton malformé, jeton signé avec un autre secret, jeton expiré, jeton
expirant dans 1 seconde — tous les cas sont traités correctement, sans exception
non gérée.

C'est une conclusion à porter en soutenance : l'authentification a été coupée
pendant 16 mois sur la foi d'un diagnostic erroné.

### 5.7 Parcours E2E

| # | Parcours | Ce qu'il traverse |
|---|---|---|
| 0 | **Routage de la passerelle (BUG-12)** | Gateway → 404 sur tout `/api/*`, contre-épreuve en direct |
| 1 | Connexion et accès refusé | Auth → PostgreSQL |
| 2 | Demande de congé et suivi du solde | Congés → PostgreSQL |
| 3 | Cycle de paie mensuel | Paie → PostgreSQL (+ Stripe neutralisé) |
| 4 | Dépôt de candidature avec CV | Recrutement → PostgreSQL + disque |
| 5 | Cycle RH complet | les 4 services enchaînés en une séquence métier |
| 6 | **Déni de service (BUG-01)** | instance isolée de Paie, tuée par une requête |

**Pourquoi les parcours 1 à 5 ne passent pas par la passerelle.** Ils ont été
écrits pour le faire, et ont tous échoué en 404. Vérification faite, ce n'était
pas eux : la passerelle ne réécrit pas le chemin des requêtes qu'elle proxifie
et aucun service n'expose de route sous `/api/` (**BUG-12**). Un parcours métier
ne peut pas traverser une passerelle qui ne route rien.

Les parcours s'adressent donc directement aux services, ce qui conserve
l'essentiel de leur valeur — services réels, PostgreSQL réel, aucun mock — et le
parcours 0 est entièrement consacré à la démonstration du défaut. Dès que
BUG-12 sera corrigé, il suffira de repointer les parcours sur la passerelle :
les adresses sont centralisées dans `tests/e2e/cibles.js`.

**Deux garde-fous notables dans ces parcours.** Le service de paie est démarré
derrière un proxy mort (`HTTP_PROXY=http://127.0.0.1:9`) : aucun appel ne peut
atteindre `api.stripe.com` avec la clé `sk_live_` du dépôt. Et le parcours 6
démarre sa **propre instance** du service de paie, puisqu'il la détruit — le
faire sur l'instance partagée ferait échouer tous les parcours suivants, ce qui
s'est effectivement produit à la première exécution.

---

## 6. Écarts entre le plan initial et le code livré

Trois scénarios prévus dans la répartition d'équipe n'ont pas pu être écrits
tels quels. Ils sont documentés ici plutôt que silencieusement abandonnés.

| Prévu | Réalité du code | Décision |
|---|---|---|
| E2E « offre + candidature » | **aucune notion d'offre d'emploi** : ni table, ni route, ni modèle | parcours 4 limité au dépôt, à la consultation et au suivi |
| E2E « entretien annuel » | **fonctionnalité inexistante** dans l'application | remplacé par le parcours 5 « cycle RH complet », qui traverse les 4 services — c'est le parcours retenu pour la démonstration |
| E2E « demande de congé → **validation** » | **aucune route de validation** : un congé est créé `en_attente` et rien ne permet de l'approuver | parcours 2 limité à la création et au suivi du solde |

Ces trois manques sont des **limites fonctionnelles de l'application livrée**,
pas des lacunes de la suite de tests. Ils méritent d'être posés en soutenance.

### Limite connue : aucun test d'interface

Le frontend n'est pas démarrable en l'état :

- `react-scripts` est invoqué par les scripts npm mais **absent des dépendances** ;
- il n'y a **ni `public/index.html`, ni `src/index.js`** — aucun point d'entrée ;
- le seul fichier de test présent n'assert rien (`expect(true).toBe(true)`).

Les parcours E2E passent donc par l'API HTTP et non par un navigateur. Le
niveau de preuve reste élevé (les 4 services et la base sont réellement
sollicités), mais le rendu et les interactions ne sont pas couverts.
**Recommandation** : supprimer `frontend/src/__tests__/login.test.js`, qui
donne une fausse impression de couverture.

---

## 7. Couverture : objectif et lecture

### Seuils appliqués (bloquants en CI)

| Métrique | Seuil | Mesuré au 23/07 (unitaires seuls) |
|---|---|---|
| Statements | 80 % | **100 %** (133/133) |
| Branches | 75 % | **92,3 %** (24/26) |
| Functions | 80 % | **100 %** (18/18) |
| Lines | 80 % | **100 %** (126/126) |

Sous le seuil, `jest` échoue et la Pull Request est bloquée.

### Ce que 100 % ne signifie pas

Le code applicatif représente 133 instructions réparties sur 5 fichiers : c'est
une base **très petite**. Atteindre 100 % y est facile et ne prouve pas
l'absence de défauts — la preuve en est que 23 défauts sont documentés dans un
code couvert à 100 %.

**La couverture mesure ce qui est exécuté, pas ce qui est vérifié.** C'est la
liste des scénarios de la section 5 qui constitue la vraie mesure de qualité.

### Exclusions

Détaillées et justifiées une par une dans
[`docs/couverture-exclusions.md`](couverture-exclusions.md). En résumé :
`src/server.js` (amorçage réseau, couvert par les E2E) et `src/db.js`
(construction du pool, remplacé en unitaire et exercé en intégration).

---

## 8. Intégration continue

| Workflow | Job | Bloquant | Dépendance |
|---|---|---|---|
| `test.yml` | Tests unitaires | oui | aucune |
| `test.yml` | Intégration + couverture (seuils) | oui | service PostgreSQL |
| `test.yml` | Parcours E2E | oui | service PostgreSQL |
| `security.yml` | gitleaks (code + historique) | oui | aucune |
| `security.yml` | npm audit (dépendances de production) | oui | aucune |
| `security.yml` | Trivy système de fichiers | oui | aucune |
| `security.yml` | Trivy images | **désactivé** | **Dockerfiles du L1** |
| `security.yml` | ZAP baseline sur l'API | oui | aucune |

La couverture est publiée en artefact, résumée dans le récapitulatif du job, et
commentée automatiquement sur la Pull Request (commentaire mis à jour et non
dupliqué à chaque exécution).

**Ces deux workflows sont autonomes** pour être livrables et vérifiables dès
aujourd'hui. Ils exposent `workflow_call` afin d'être appelés tels quels comme
stages du pipeline unique du L1, sans réécriture.

---

## 9. Critères d'acceptation du livrable L2

- [x] Plan de tests rédigé, scénarios tracés
- [x] Suite unitaire exécutable en local et en CI, sans infrastructure
- [x] Suite d'intégration sur PostgreSQL réel
- [x] 7 parcours de bout en bout (41 tests)
- [x] Couverture ≥ 80 % mesurée et **bloquante** en CI
- [x] Rapport de couverture publié en artefact et commenté sur la PR
- [x] Stage Security bloquant : secrets, dépendances, système de fichiers, scan dynamique
- [ ] Scan Trivy des images — **en attente des Dockerfiles du L1**
- [x] Défauts non couverts recensés et justifiés

Les points en attente et leurs conditions de levée sont dans
[`docs/blocages-inter-livrables.md`](blocages-inter-livrables.md).

---

## 10. Maintenance de la suite

- **Une correction de défaut rend un test rouge.** C'est voulu : les tests
  préfixés `VULN-` et `BUG-` constatent le comportement actuel. Le jour où le
  code est corrigé, il faut réécrire le test en non-régression — la procédure
  est décrite dans [`docs/regressions-detectees.md`](regressions-detectees.md).
- **Toute nouvelle route arrive avec ses tests**, au niveau le plus bas où son
  comportement est observable.
- **Aucune exception n'est ajoutée à `.zap-rules.tsv` ou `.gitleaks.toml` pour
  faire passer la CI** sans justification, responsable et échéance inscrits
  dans le fichier.
