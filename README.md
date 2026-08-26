# NovaTech HRFlow

Plateforme RH modulaire de NovaTech pour centraliser l'authentification, la paie,
les congés et le recrutement. Le dépôt réunit l'application React, cinq services
Node.js, l'infrastructure AWS avec Terraform, le pipeline GitHub Actions, les
tests automatisés et l'observabilité L4.

> **État documenté.** L3 et L4 sont intégrés à `main`. Le dépôt contient la
> cible AWS, le déploiement continu, les smoke tests et le monitoring. L'état
> courant des ressources AWS et la dernière exécution du pipeline doivent être
> confirmés dans AWS et GitHub Actions : une copie Git locale ne les prouve pas.
> Les limites du workshop figurent dans la [documentation J3](docs/j3-architecture.md)
> et les [régressions détectées](docs/regressions-detectees.md).

## Sommaire

- [Objectif et modules](#objectif-et-modules)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Structure du dépôt](#structure-du-dépôt)
- [Prérequis](#prérequis)
- [Démarrage local](#démarrage-local)
- [Variables d'environnement](#variables-denvironnement)
- [Tests et qualité](#tests-et-qualité)
- [CI/CD et déploiement](#cicd-et-déploiement)
- [Infrastructure AWS avec Terraform](#infrastructure-aws-avec-terraform)
- [Monitoring](#monitoring)
- [OpenAPI et Swagger UI](#openapi-et-swagger-ui)
- [Sécurité](#sécurité)
- [Contribution](#contribution)
- [Documentation](#documentation)

## Objectif et modules

| Module | Responsabilité | Port local |
|---|---|---:|
| Frontend | Interface React servie par Nginx dans l'image de production | 80 (conteneur) |
| API Gateway | Point d'entrée `/api`, routage, CORS, authentification et feature flag | 3000 |
| Auth | Connexion, émission et vérification des JWT | 3001 |
| Paie | Calculs de paie, heures supplémentaires et versements | 3002 |
| Congés | Soldes et demandes de congés | 3003 |
| Recrutement | Candidatures, CV et suivi de statut | 3004 |

Les services métier utilisent PostgreSQL. La Gateway les joint directement en
local et par DNS privé AWS Cloud Map dans les environnements AWS.

## Stack technique

| Couche | Technologies vérifiées dans le dépôt |
|---|---|
| Frontend | React 18.2, React Router, Axios, Create React App |
| Backend | Node.js, Express 4, `pg`, JWT, `prom-client` |
| Données | PostgreSQL 15 en test local ; Amazon RDS PostgreSQL sur AWS |
| Conteneurs | Docker, `node:24-bookworm-slim`, Nginx 1.29 Alpine |
| Cloud | ECS Fargate, ALB, ECR, RDS, Secrets Manager, Cloud Map, CloudWatch |
| IaC et CI/CD | Terraform, GitHub Actions, GitHub OIDC et AWS IAM |
| Tests | Jest 29, Supertest 6 et Playwright 1.44 |
| Observabilité | Prometheus, Grafana et Alertmanager |
| Contrats API | OpenAPI 3 et Swagger UI 5.17 |

Le pipeline utilise Node.js 20 ; les images applicatives utilisent Node.js 24.
La base locale et CI repose sur `postgres:15-alpine`.

## Architecture

### Flux applicatif

```mermaid
flowchart LR
    U[Utilisateur] --> ALB[Application Load Balancer]
    ALB --> FE[Frontend React / Nginx]
    ALB --> GW[API Gateway]
    GW -->|Cloud Map| A[Auth]
    GW -->|Cloud Map| P[Paie]
    GW -->|Cloud Map| C[Congés]
    GW -->|Cloud Map| R[Recrutement]
    A --> DB[(RDS PostgreSQL)]
    P --> DB
    C --> DB
    R --> DB
```

L'ALB route `/*` vers le frontend et `/api/*` vers la Gateway. Les quatre
services métier ne sont pas exposés par l'ALB. RDS reste privé et n'accepte
PostgreSQL que depuis le groupe de sécurité ECS.

### Flux de livraison

```mermaid
flowchart LR
    GH[GitHub Actions] -->|OIDC temporaire| IAM[AWS IAM]
    IAM --> ECR[Amazon ECR]
    ECR --> ECS[ECS Fargate]
    ECS --> STG[Staging + smoke tests]
    STG --> PROD[Production]
```

Aucune clé AWS statique n'est requise. Les six images sont poussées dans ECR
avec un tag immuable `sha-<git-sha>`.

### Environnements

`staging` et `production` ont des racines Terraform, VPC, ALB, clusters ECS,
RDS, secrets et états distincts. ECR et l'identité GitHub OIDC sont partagés. Le
pipeline traite staging et ses smoke tests avant production.

## Structure du dépôt

```text
frontend/                    application React et image Nginx
services/
  api-gateway/               passerelle HTTP et routage
  auth/                      authentification et JWT
  paie/                      domaine paie
  conges/                    domaine congés
  recrutement/              domaine recrutement
infra/terraform/
  shared/                    ECR partagé et identité GitHub OIDC
  environments/staging/     infrastructure staging
  environments/production/  infrastructure production
  modules/                   modules AWS réutilisables
monitoring/                  Prometheus, Grafana et Alertmanager
tests/                       unitaires, intégration et E2E
docs/                        architecture, tests, runbooks et OpenAPI
.github/workflows/           pipeline Build, Test, Security et déploiement
db/                          schéma, données de test et migration staging
docker-compose.test.yml      PostgreSQL jetable pour les tests
```

Les workflows J3 utilisent les Dockerfiles de `frontend/` et `services/*/`.
Le dossier `docker/` contient des fichiers historiques distincts.

## Prérequis

- Git ;
- Node.js 20 ou une version compatible avec les lockfiles, et npm ;
- Docker et Docker Compose v2 pour la base de test et le monitoring ;
- PostgreSQL et `psql` seulement sans Docker local ;
- Terraform pour les validations et opérations d'infrastructure autorisées ;
- AWS CLI uniquement pour les opérations cloud autorisées.

```bash
git --version
node --version
npm --version
docker --version
docker compose version
terraform version
```

## Démarrage local

### 1. Cloner et installer

```bash
git clone https://github.com/Veudzveulay/novatech.git
cd novatech
npm ci
npm ci --prefix frontend
```

Le premier `npm ci` installe les outils racine et les workspaces
`services/*`. Le frontend doit être installé séparément.

### 2. Préparer PostgreSQL

```bash
npm run db:test:up
docker exec -i hrflow-postgres-test psql -U hrflow_test -d hrflow_test < db/schema.sql
docker exec -i hrflow-postgres-test psql -U hrflow_test -d hrflow_test < db/seed-test.sql
```

Sous PowerShell, utiliser le pipeline suivant à la place de la redirection Bash :

```powershell
Get-Content -Raw db/schema.sql |
  docker exec -i hrflow-postgres-test psql -U hrflow_test -d hrflow_test
Get-Content -Raw db/seed-test.sql |
  docker exec -i hrflow-postgres-test psql -U hrflow_test -d hrflow_test
```

Ces identifiants sont des valeurs locales de test définies dans
`docker-compose.test.yml`. Suppression de la base jetable :

```bash
npm run db:test:down
```

### 3. Configurer l'environnement

Le code ne charge pas automatiquement un fichier `.env`. Définir les variables
dans le shell ou un mécanisme local non versionné :

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://hrflow_test:hrflow_test@localhost:55432/hrflow_test
export DB_HOST=localhost
export DB_PORT=55432
export DB_NAME=hrflow_test
export DB_USER=hrflow_test
export DB_PASSWORD=hrflow_test
export JWT_SECRET=local-only-replace-me
export STRIPE_SECRET_KEY=sk_test_local_placeholder
export UPLOAD_DIR=./.local-uploads
export CORS_ALLOWED_ORIGINS=http://localhost:3005
```

Sous PowerShell, utiliser `$env:NOM = "valeur"` à la place de `export`.

### 4. Démarrer les backends

Ouvrir un terminal par processus :

```bash
node services/auth/src/server.js
node services/paie/src/server.js
node services/conges/src/server.js
node services/recrutement/src/server.js
node services/api-gateway/src/server.js
```

`npm run dev` à la racine démarre uniquement la Gateway.

### 5. Démarrer le frontend

Le port 3000 étant pris par la Gateway, utiliser 3005 pour React :

```bash
cd frontend
PORT=3005 REACT_APP_API_URL=http://localhost:3000/api npm start
```

Sous PowerShell :

```powershell
$env:PORT = "3005"
$env:REACT_APP_API_URL = "http://localhost:3000/api"
npm start
```

Ouvrir <http://localhost:3005>. Vérifier ensuite :

```bash
curl --fail http://localhost:3000/health
curl --fail http://localhost:3001/health
curl --fail http://localhost:3002/health
curl --fail http://localhost:3003/health
curl --fail http://localhost:3004/health
```

Les cinq backends exposent également `/metrics`.

## Variables d'environnement

Les exemples sont fictifs ou locaux. `DATABASE_URL` et les cinq `DB_*` sont
des formes alternatives pour les services prenant en charge l'URL.

| Variable | Composant | Description | Exigence | Exemple non sensible |
|---|---|---|---|---|
| `NODE_ENV` | Backends | Environnement Node | Optionnelle | `development` |
| `PORT` | Gateway | Port d'écoute, défaut 3000 | Optionnelle | `3000` |
| `AUTH_PORT` | Auth | Port, défaut 3001 | Optionnelle | `3001` |
| `PAIE_PORT` | Paie | Port, défaut 3002 | Optionnelle | `3002` |
| `CONGES_PORT` | Congés | Port, défaut 3003 | Optionnelle | `3003` |
| `RECRUTEMENT_PORT` | Recrutement | Port, défaut 3004 | Optionnelle | `3004` |
| `JWT_SECRET` | Auth, Gateway | Signature/vérification JWT | Obligatoire pour l'auth | `local-only-replace-me` |
| `STRIPE_SECRET_KEY` | Paie | Clé d'appel Stripe | Obligatoire pour le versement | `sk_test_local_placeholder` |
| `DATABASE_URL` | Paie, Congés, Recrutement | URL PostgreSQL complète | Alternative aux `DB_*` | `postgresql://user:pass@localhost:55432/db` |
| `DB_HOST` | Services PostgreSQL | Hôte PostgreSQL | Obligatoire sans URL | `localhost` |
| `DB_PORT` | Services PostgreSQL | Port PostgreSQL | Obligatoire sans URL | `55432` |
| `DB_NAME` | Services PostgreSQL | Base | Obligatoire sans URL | `hrflow_test` |
| `DB_USER` | Services PostgreSQL | Utilisateur | Obligatoire sans URL | `hrflow_test` |
| `DB_PASSWORD` | Services PostgreSQL | Mot de passe | Obligatoire sans URL | `local-test-only` |
| `DB_SSL` | Services PostgreSQL | Active TLS avec `true` | Optionnelle | `false` |
| `DB_SSL_CA_PATH` | Services PostgreSQL | Chemin du CA TLS | Requise si TLS actif | `/app/certs/rds-ca.pem` |
| `AUTH_SERVICE_URL` / `AUTH_URL` | Gateway | URL Auth | Optionnelle | `http://localhost:3001` |
| `PAIE_SERVICE_URL` / `PAIE_URL` | Gateway | URL Paie | Optionnelle | `http://localhost:3002` |
| `CONGES_SERVICE_URL` / `CONGES_URL` | Gateway | URL Congés | Optionnelle | `http://localhost:3003` |
| `RECRUTEMENT_SERVICE_URL` / `RECRUTEMENT_URL` | Gateway | URL Recrutement | Optionnelle | `http://localhost:3004` |
| `FEATURE_RECRUITMENT_ENABLED` | Gateway | Désactive le recrutement si `false` | Optionnelle, activé par défaut | `true` |
| `CORS_ALLOWED_ORIGINS` | Gateway | Origines séparées par virgules | Optionnelle | `http://localhost:3005` |
| `UPLOAD_DIR` | Recrutement | Répertoire des CV | Optionnelle | `./.local-uploads` |
| `REACT_APP_API_URL` | Frontend | Base URL API au build | Optionnelle, défaut `/api` | `http://localhost:3000/api` |
| `E2E_BASE_URL` | Playwright | URL de la Gateway | Optionnelle | `http://localhost:3000` |
| `E2E_AUTH_URL` | Playwright | URL directe du service Auth pour les parcours E2E | Optionnelle, défaut local | `http://localhost:3001` |
| `E2E_PAIE_URL` | Playwright | URL directe du service Paie pour les parcours E2E | Optionnelle, défaut local | `http://localhost:3002` |
| `E2E_CONGES_URL` | Playwright | URL directe du service Congés pour les parcours E2E | Optionnelle, défaut local | `http://localhost:3003` |
| `E2E_RECRUTEMENT_URL` | Playwright | URL directe du service Recrutement pour les parcours E2E | Optionnelle, défaut local | `http://localhost:3004` |
| `TEST_DATABASE_URL` | Tests | URL PostgreSQL de test | Optionnelle | `postgresql://user:pass@localhost:55432/db` |
| `TEST_DB_HOST` / `TEST_DB_PORT` | Tests | Hôte et port de test | Optionnelles | `localhost` / `55432` |

Le webhook Slack est lu depuis le fichier local ignoré
`monitoring/alertmanager/slack_webhook_url`. En AWS, `JWT_SECRET`,
`STRIPE_SECRET_KEY`, `DB_USER` et `DB_PASSWORD` sont injectés depuis AWS
Secrets Manager. Aucun secret ne doit entrer dans Git ou Terraform.

## Tests et qualité

### Résultats réellement exécutés

Validation locale du 26 août 2026, après `npm ci`, avec PostgreSQL 15 dans le
conteneur de test du projet :

| Niveau | Outil | Commande réelle | Réussis | Échoués | Ignorés | Durée |
|---|---|---|---:|---:|---:|---:|
| Unitaires | Jest + Supertest | `npm run test:unit -- --ci --reporters=default` | 103 | 0 | 0 | 13,319 s |
| Intégration | Jest + PostgreSQL | `npm run test:integration -- --ci --reporters=default` | 35 | 0 | 0 | 30,454 s |
| E2E API | Playwright | `npm run test:e2e` | 41 | 0 | 0 | 48,8 s |
| **Total** | — | — | **179** | **0** | **0** | — |

Les tests L4 de `tests/unit/metrics.test.js` sont inclus dans les 103 tests
unitaires. Les E2E couvrent sept parcours et traversent les API avec de vrais
processus Node ; ils ne pilotent pas l'interface React.

### Référence historique

Le [plan de tests historique](docs/plan-de-tests.md), antérieur aux ajouts L4,
référence 83 tests unitaires, 38 tests d'intégration et 41 E2E. Ces chiffres sont
conservés comme trace documentaire, mais les résultats exécutés ci-dessus font
référence pour l'état actuel du dépôt. La suite de couverture agrégée n'a pas été
relancée pendant cette validation.

```bash
npm run db:test:up
npm run test:integration
npm run test:e2e
npm run db:test:down
```

Les seuils globaux de `jest.config.js` sont 80 % pour statements, fonctions et
lignes, et 75 % pour les branches. Voir les
[exclusions de couverture](docs/couverture-exclusions.md).

## CI/CD et déploiement

Le workflow [`shipit.yml`](.github/workflows/shipit.yml) enchaîne cinq stages :

1. **Build** — installation, contrôles disponibles et six builds Docker ;
2. **Test** — unitaires, intégration, couverture et Playwright ;
3. **Security** — Gitleaks, `npm audit`, Trivy et ZAP baseline ;
4. **Staging** — ECR, task definitions ECS, stabilisation et smoke tests ;
5. **Production** — déploiement ECS et smoke tests.

Les images sont taguées `sha-${{ github.sha }}`, jamais `latest`. Les smoke
tests appellent `/health` et une requête `OPTIONS` sûre.

Frontend et Gateway utilisent le Blue/Green natif ECS avec deux target groups,
une route preview et des alarmes. Les services internes utilisent un rolling
update 100/200 %, un circuit breaker et le rollback automatique. Le
[runbook](docs/j3-rollback-runbook.md) décrit le retour à une task definition et
une image SHA connues. Déploiements et rollbacks exigent une autorisation humaine.

## Infrastructure AWS avec Terraform

L'IaC se trouve dans [`infra/terraform/`](infra/terraform/README.md) :

- `shared/` : six repositories ECR et GitHub OIDC ;
- `environments/staging/` : pile staging isolée ;
- `environments/production/` : pile production isolée ;
- `modules/` : réseau, sécurité, ALB, ECS, RDS, secrets et ECR.

Chaque environnement décrit VPC, ALB, six services Fargate, Cloud Map, RDS privé
et Secrets Manager. Le workshop évite un NAT Gateway pour le budget ; les tâches
utilisent des subnets publics et un Security Group restrictif. RDS est non
public, chiffré, et les images backend embarquent le bundle CA AWS.

Validations locales sans accès AWS :

```bash
terraform -chdir=infra/terraform/shared fmt -check
terraform -chdir=infra/terraform/shared init -backend=false
terraform -chdir=infra/terraform/shared validate
```

Répéter pour `environments/staging` et `environments/production`.
`terraform plan` connecté à AWS, `apply`, `destroy`, les commandes AWS, les
déploiements et rollbacks exigent une autorisation et une identité dédiée.

## Monitoring

Les cinq backends exposent `/metrics`. Le dossier
[`monitoring/`](monitoring/README.md) contient :

- `prometheus/prometheus.yml` : cibles Cloud Map ;
- `prometheus/prometheus.local.yml` : cibles locales ;
- `prometheus/rules/alerts.yml` : golden signals et `ServiceDown` ;
- `grafana/dashboards/hrflow-golden-signals.json` : dashboard ;
- `alertmanager/alertmanager.yml` : routage Slack ;
- `docker-compose.monitoring.yml` : démonstration locale.

Les quatre golden signals sont latence, trafic, erreurs et saturation.
`ServiceDown` se déclenche après une minute sans scrape.

```bash
cp monitoring/alertmanager/slack_webhook_url.example monitoring/alertmanager/slack_webhook_url
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

Remplacer le fichier copié par un webhook de test valide sans le committer.
Accès : Prometheus <http://localhost:9090>, Grafana <http://localhost:3080> et
Alertmanager <http://localhost:9093>. Arrêt :

```bash
docker compose -f monitoring/docker-compose.monitoring.yml down
```

La configuration VPC scrape les quatre services métier via Cloud Map. La
Gateway n'y est pas enregistrée ; la configuration locale la scrape néanmoins.

## OpenAPI et Swagger UI

Les contrats OpenAPI 3 d'Auth, Paie, Congés et Recrutement sont dans
[`docs/openapi/`](docs/openapi/README.md).

```bash
npx --yes http-server docs/openapi -p 8088
```

Ouvrir <http://localhost:8088>. Les assets Swagger UI viennent d'unpkg : une
connexion Internet est nécessaire. Swagger UI n'est pas servie par la Gateway.

## Sécurité

- GitHub Actions utilise OIDC/IAM, jamais une clé AWS statique ;
- les secrets cloud sont stockés dans Secrets Manager et injectés dans ECS ;
- RDS n'est pas public, son stockage est chiffré et les connexions AWS utilisent TLS ;
- Gitleaks analyse le code et l'historique avec rédaction des secrets ;
- Trivy analyse les sources et les six images Docker ;
- `npm audit --omit=dev --audit-level=high` contrôle les dépendances ;
- ZAP baseline effectue un scan dynamique de l'API en CI ;
- les rapports sont publiés comme artefacts à rétention limitée.

Ne jamais committer `.env`, webhook, mot de passe, token, clé Stripe, ARN de
compte ou valeur de secret.

## Contribution

1. Partir de `main` à jour :

   ```bash
   git switch main
   git pull --ff-only origin main
   ```

2. Créer `feature/description`, `fix/description` ou `docs/description`.
3. Implémenter un changement limité et lancer les tests pertinents.
4. Vérifier statut, diff et absence de secret.
5. Utiliser des commits conventionnels :
   - `feat: expose un nouveau parcours de congé`
   - `fix: refuse un jeton expiré`
   - `docs: précise le démarrage local`
   - `test: couvre le calcul des heures supplémentaires`
6. Pousser la branche et ouvrir une Pull Request vers `main`.
7. Attendre CI et review avant fusion ; ne jamais pousser directement sur `main`.

## Documentation

- [Architecture applicative](docs/architecture.md)
- [Architecture AWS J3](docs/j3-architecture.md)
- [Contrat des composants J3](docs/j3-component-contract.md)
- [Pipeline J3](docs/j3-pipeline.md)
- [Blue/Green](docs/j3-blue-green.md)
- [Feature flag recrutement](docs/j3-feature-flag.md)
- [Runbook de rollback](docs/j3-rollback-runbook.md)
- [Runbook incident P1](docs/runbook-incident-p1.md)
- [Plan de tests](docs/plan-de-tests.md)
- [Couverture et exclusions](docs/couverture-exclusions.md)
- [Défauts et régressions](docs/regressions-detectees.md)
- [OpenAPI et Swagger UI](docs/openapi/README.md)
- [Monitoring L4](monitoring/README.md)
- [Guide Terraform](infra/terraform/README.md)

Ce README décrit l'état versionné. Les preuves d'exécution — pipeline vert,
ressources AWS actives, captures et métriques — doivent être datées, sans secret
et conservées séparément lorsqu'elles sont produites.

## Contributeurs

Projet réalisé dans le cadre du BC03 — ShipIt, M2 Lead Dev Full Stack.

- **Anna-Merveille KAYA** — Infrastructure Cloud, déploiement AWS, Terraform, Blue/Green, rollback, feature flags et documentation.
- **Lucas DEVELAY** — Tests & Qualité, couverture, monitoring Prometheus/Grafana/Alertmanager, OpenAPI/Swagger et runbook incident.
- **JAKUBOWICZ Lea** — Audit & Architecture du pipeline, stratégie Git, architecture CI/CD en 5 stages, Dockerfiles multi-stage et workflow GitHub Actions Build/Lint/Type-check.

### Répartition principale des livrables

- **J1 — Audit & Architecture du pipeline** : JAKUBOWICZ Lea
- **J2 — Tests & Qualité** : Lucas DEVELAY
- **J3 — Infra Cloud & Déploiement** : Anna-Merveille KAYA
- **J4 — Monitoring, OpenAPI & Runbook** : Lucas DEVELAY
- **J5 — Documentation finale / README** : contribution collective, finalisation par Anna-Merveille KAYA

---

**Dernière mise à jour : 26 août 2026**
