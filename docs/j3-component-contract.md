# Contrat technique des composants — Livrable J3

## Objet et périmètre

Ce document fige le contrat technique minimal des six composants applicatifs
de NovaTech HRFlow avant leur conteneurisation et leur déploiement sur ECS.

Il est fondé uniquement sur le code actuellement présent dans le dépôt et sur
l'énoncé officiel. Les chemins Docker, noms ECS et URL de service sont des
conventions cibles : aucune infrastructure AWS correspondante n'existe encore
dans le dépôt.

Aucune valeur de secret ou de variable d'environnement n'est documentée ici.

## Contrat des composants

| Nom normalisé | Chemin réel | Contexte Docker prévu | Dockerfile prévu | Commande réellement présente | Port réel | `PORT` recommandé | Health check | Dépendances | Variables d'environnement | URL interne ECS prévue | Exposition | Responsabilité | Statut actuel |
|---|---|---|---|---|---:|---:|---|---|---|---|---|---|---|
| `frontend` | `frontend/` | `frontend/` | `frontend/Dockerfile` | `npm start` (`react-scripts start`) | `3000` en développement ; `80` prévu avec Nginx | `80` pour l'image ECS | `/health` à fournir par Nginx ; absente du dépôt actuel | API Gateway ; aucune dépendance PostgreSQL ou Redis directe confirmée | `REACT_APP_API_URL` | Pas d'URL de découverte interne requise ; accès public prévu via l'ALB | Publique via ALB | J1 : image ; J2 : tests ; J3 : ALB et déploiement | **Bloquant** — Dockerfile absent du dépôt, structure de build à valider et health check absent |
| `api-gateway` | `services/api-gateway/` | `services/api-gateway/` | `services/api-gateway/Dockerfile` | `npm start` (`node src/index.js`) | `3000` | `3000` | `GET /health` existante | Services auth, paie, congés et recrutement ; aucune dépendance PostgreSQL ou Redis directe confirmée | `PORT` à ajouter ; `AUTH_SERVICE_URL`, `PAIE_SERVICE_URL`, `CONGES_SERVICE_URL`, `RECRUTEMENT_SERVICE_URL` à ajouter ; `JWT_SECRET` est actuellement référencée | `http://api-gateway.<environment>.novatech.local:3000` | Publique via ALB sur `/api/*` ; découverte interne possible | J1 : image ; J2 : tests/sécurité ; J3 : routage ECS | **Bloquant** — Dockerfile absent et destinations interservices actuellement codées sur `localhost` |
| `auth` | `services/auth/` | `services/auth/` | `services/auth/Dockerfile` | `npm start` (`node src/index.js`) | `3001` | `3001` | `GET /health` à créer | PostgreSQL ; bibliothèque JWT ; aucune utilisation de Redis confirmée | `PORT` à ajouter ; `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` | `http://auth.<environment>.novatech.local:3001` | Interne uniquement | J1 : image ; J2 : health check, tests et sécurité ; J3 : ECS, découverte et secrets | **Bloquant** — Dockerfile et health check absents ; gestion actuelle des secrets incompatible avec J3 |
| `paie` | `services/paie/` | `services/paie/` | `services/paie/Dockerfile` | `npm start` (`node src/index.js`) | `3002` | `3002` | `GET /health` à créer | PostgreSQL ; API Stripe externe ; aucune utilisation de Redis confirmée | `PORT` à ajouter ; `DATABASE_URL`, `STRIPE_SECRET_KEY` | `http://paie.<environment>.novatech.local:3002` | Interne uniquement | J1 : image ; J2 : health check, tests et sécurisation ; J3 : ECS et secrets | **Bloquant** — Dockerfile et health check absents ; route de migration à sécuriser |
| `conges` | `services/conges/` | `services/conges/` | `services/conges/Dockerfile` | `npm start` (`node src/index.js`) | `3003` | `3003` | `GET /health` à créer | PostgreSQL ; aucune utilisation de Redis ou API externe confirmée | `PORT` à ajouter ; `DATABASE_URL` | `http://conges.<environment>.novatech.local:3003` | Interne uniquement | J1 : image ; J2 : health check, tests et sécurité ; J3 : ECS et secrets | **Bloquant** — Dockerfile et health check absents |
| `recrutement` | `services/recrutement/` | `services/recrutement/` | `services/recrutement/Dockerfile` | `npm start` (`node src/index.js`) | `3004` | `3004` | `GET /health` à créer | PostgreSQL ; stockage local temporaire des CV dans `/tmp/uploads/` ; aucune utilisation de Redis confirmée | `PORT` à ajouter ; `DATABASE_URL` | `http://recrutement.<environment>.novatech.local:3004` | Interne uniquement | J1 : image ; J2 : health check, tests et sécurité ; J3 : ECS, secrets et stockage durable à décider | **Bloquant** — Dockerfile et health check absents ; stockage des CV non durable sur ECS |

`<environment>` représente obligatoirement `staging` ou `production`. Le
namespace DNS privé `novatech.local` est une convention proposée pour AWS Cloud
Map ou ECS Service Connect ; son existence et sa disponibilité doivent être
validées lors de l'implémentation Terraform.

## 1. Convention des images ECR

Un repository ECR distinct est prévu pour chaque composant :

```text
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/frontend
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/api-gateway
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/auth
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/paie
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/conges
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/novatech/recrutement
```

L'identifiant du compte AWS et la région ne sont pas encore connus. Ils ne
doivent jamais être codés en dur dans les Dockerfiles ou le code applicatif.
Ils seront fournis par les sorties Terraform et les variables du workflow.

Les noms normalisés ci-dessus sont les seuls noms à utiliser dans ECR, ECS,
les workflows et la documentation. Les variantes `front`, `service-paie`,
`service-conges` et `service-recrutement` ne doivent pas être employées comme
identifiants de déploiement.

## 2. Convention des tags utilisant le SHA Git

Chaque image déployable doit recevoir un tag immuable construit à partir du SHA
Git exact :

```text
<repository-ecr>:sha-<sha-git-complet>
```

Exemple de forme, sans valeur réelle :

```text
novatech/api-gateway:sha-<sha-git-complet>
```

Les mêmes images, identifiées par leur digest ECR et leur tag SHA, doivent être
promues de staging vers production sans reconstruction. Une task definition ECS
ne doit pas référencer `latest`. Un tag lisible supplémentaire peut être publié
pour information, mais il ne doit pas servir de référence de déploiement.

## 3. Convention des noms ECS

Les ressources applicatives suivent la forme :

```text
novatech-<environment>-<component>-<resource>
```

Exemples génériques :

```text
novatech-staging-auth-service
novatech-staging-auth-task
novatech-production-api-gateway-service
novatech-production-api-gateway-task
```

Valeurs autorisées :

- environnement : `staging` ou `production` ;
- composant : l'un des six noms normalisés du tableau ;
- ressource : `service`, `task`, `log`, `tg-blue`, `tg-green` ou un suffixe
  Terraform documenté.

La décision finale sur un cluster ECS partagé ou un cluster par environnement
n'est pas confirmée par le dépôt. Quel que soit le choix Terraform, les services,
task definitions, secrets et groupes de logs doivent rester distincts entre
staging et production.

## 4. Convention des variables interservices

L'API Gateway doit recevoir les destinations suivantes :

| Variable | Service cible | Forme prévue |
|---|---|---|
| `AUTH_SERVICE_URL` | `auth` | `http://auth.<environment>.novatech.local:3001` |
| `PAIE_SERVICE_URL` | `paie` | `http://paie.<environment>.novatech.local:3002` |
| `CONGES_SERVICE_URL` | `conges` | `http://conges.<environment>.novatech.local:3003` |
| `RECRUTEMENT_SERVICE_URL` | `recrutement` | `http://recrutement.<environment>.novatech.local:3004` |

Règles :

- aucune URL AWS ou adresse IP ne doit être codée en dur dans le code ;
- les variables non sensibles sont fournies par la task definition ECS ;
- les secrets sont référencés depuis AWS Secrets Manager et non stockés comme
  variables en clair dans GitHub Actions ou Terraform ;
- les valeurs locales éventuelles doivent être documentées dans un fichier
  d'exemple sans secret ;
- `REACT_APP_API_URL` doit cibler l'entrée publique de l'API Gateway via l'ALB ;
- `PORT` doit être lu par chaque serveur avec la valeur recommandée du tableau
  comme valeur par défaut.

Le code actuel ne lit ni `PORT` ni les quatre variables interservices. Leur
prise en charge reste donc à implémenter et à tester.

## 5. Critères minimum d'une image prête pour J3

Une image n'est considérée prête pour J3 que si tous les critères suivants sont
remplis :

1. son Dockerfile est versionné au chemin défini dans ce document ;
2. son contexte Docker ne dépend d'aucun fichier situé hors du contexte annoncé ;
3. la construction réussit à partir d'un checkout propre ;
4. les dépendances sont reproductibles au moyen d'un lockfile versionné ;
5. la commande de démarrage correspond à une commande réellement définie dans
   le `package.json` du composant ;
6. le processus écoute sur `PORT`, avec la valeur par défaut définie ici ;
7. le conteneur expose uniquement le port applicatif attendu ;
8. `GET /health` retourne un statut HTTP 200 sans modifier de donnée métier et
   sans révéler de secret ;
9. le health check du conteneur atteint la route et le port réels ;
10. aucun secret ni identifiant d'infrastructure n'est inclus dans l'image ;
11. le processus ne journalise aucune valeur sensible ;
12. l'image peut recevoir un tag SHA immuable et être utilisée sans
    reconstruction en staging puis en production ;
13. les tests J2 et le scan de sécurité associés ont réussi ;
14. l'image s'exécute sans dépendre de `localhost` pour joindre un autre
    composant ECS ;
15. les dépendances persistantes ou externes sont injectées par configuration
    et documentées.

À la date de création de ce contrat, aucun des six composants ne satisfait
l'ensemble de ces critères.

## Informations non confirmées

Les informations suivantes ne peuvent pas être confirmées avec les fichiers
actuellement présents :

- le compte AWS, la région AWS et les noms DNS publics ;
- le mécanisme définitif de découverte interne, Cloud Map ou ECS Service Connect ;
- le choix définitif entre un cluster partagé et deux clusters ECS ;
- la présence future d'un certificat TLS et d'un nom de domaine ;
- la structure complète et actuellement constructible du frontend React ;
- l'existence de lockfiles, absents du dépôt au moment de l'analyse ;
- l'utilisation réelle de Redis, annoncée dans la documentation mais absente du
  code inspecté ;
- la solution durable de stockage des CV du service recrutement ;
- la liste définitive des fonctionnalités couvertes par un feature flag ;
- les scripts lint, type-check et build définitifs des backends ;
- les valeurs des variables d'environnement et des secrets, volontairement non
  consultées et hors périmètre de ce contrat.
