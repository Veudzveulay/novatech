# Préparation applicative ECS — Livrable J3

## Statut

Ce document décrit la compatibilité applicative et Docker préparée localement.
Il ne prouve aucun déploiement AWS. Les résultats de validation sont consignés
uniquement après exécution réelle.

## Contrat par composant

| Composant | Port | Health | Variables non sensibles | Secrets attendus | PostgreSQL | URLs interservices | Docker build | Health test | Statut |
|---|---:|---|---|---|---|---|---|---|---|
| `frontend` | 80 | Nginx `GET /health` | `REACT_APP_API_URL` au build, avec `/api` par défaut | Aucun | Non | API publique relative `/api` par défaut | Réussi : `novatech/frontend:local` | HTTP 200 ; SPA HTTP 200 | Prêt localement |
| `api-gateway` | 3000 | `GET /health` | `PORT`, `AUTH_SERVICE_URL`, `PAIE_SERVICE_URL`, `CONGES_SERVICE_URL`, `RECRUTEMENT_SERVICE_URL` | `JWT_SECRET` pour le middleware d'authentification | Non | Quatre services internes ; fallback localhost réservé au développement | Réussi : `novatech/api-gateway:local` | HTTP 200 en conteneur | Prêt localement |
| `auth` | 3001 | `GET /health` | `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME` | `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` | Oui, configuration `DB_*` | Aucune | Réussi : `novatech/auth:local` | HTTP 200 en conteneur | Prêt localement |
| `paie` | 3002 | `GET /health` | `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME` | `DB_USER`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`; `DATABASE_URL` seulement si explicitement fournie localement | Oui | API Stripe externe lors du calcul de paie | Réussi : `novatech/paie:local` | HTTP 200 en conteneur | Prêt localement |
| `conges` | 3003 | `GET /health` | `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME` | `DB_USER`, `DB_PASSWORD`; `DATABASE_URL` seulement si explicitement fournie localement | Oui | Aucune | Réussi : `novatech/conges:local` | HTTP 200 en conteneur | Prêt localement |
| `recrutement` | 3004 | `GET /health` | `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME` | `DB_USER`, `DB_PASSWORD`; `DATABASE_URL` seulement si explicitement fournie localement | Oui | Aucune | Réussi : `novatech/recrutement:local` | HTTP 200 en conteneur | Prêt localement ; stockage durable à traiter |

## Configuration PostgreSQL

`paie`, `conges` et `recrutement` appliquent la priorité suivante :

1. `DATABASE_URL` lorsqu'elle est explicitement définie, pour conserver la
   compatibilité locale existante ;
2. sinon `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` et `DB_PASSWORD`, compatibles
   avec l'injection ECS préparée.

`auth` utilise directement les cinq variables `DB_*`. Aucun mot de passe, nom
d'utilisateur ou hostname de production ne possède de valeur de repli dans le
code. Le port PostgreSQL conserve le fallback local non sensible `5432`.

Les routes `/health` ne contactent pas PostgreSQL. Le démarrage HTTP peut donc
être vérifié sans créer de base locale ni fournir de credentials.

## JWT et Stripe

`JWT_SECRET` provient exclusivement de l'environnement. Les opérations de
connexion, de vérification ou le middleware Gateway répondent par une erreur
générique lorsque la variable manque, sans afficher sa valeur. Le démarrage et
les routes `/health` n'exigent pas ce secret.

`STRIPE_SECRET_KEY` provient exclusivement de l'environnement. Son absence ne
bloque pas le démarrage de `paie`; le chemin de paiement signale une erreur
fonctionnelle générique, déjà ignorée par le comportement historique du service,
sans construire de credential fictif.

## Conteneurisation

Les cinq services Node utilisent Node 20, `npm ci --omit=dev`, le script `start`
réel, un utilisateur non-root et leur port contractuel. `auth` conserve son
Dockerfile multi-stage existant. Chaque contexte exclut notamment `.env`, les
dépendances locales, Git, les logs et les fichiers temporaires.

Le frontend utilise un build `react-scripts` dont la sortie réelle est `build`,
puis une image Nginx. Nginx sert la SPA et répond directement en HTTP 200 sur
`/health`. Le frontend utilise `/api` par défaut, ce qui permet un accès via le
même ALB sans hostname AWS codé en dur.

## Limites connues

- Les fichiers CV de `recrutement` restent écrits dans `/tmp/uploads`; ce stockage
  éphémère n'est pas durable sur ECS.
- La sécurisation des routes de migration et de debug existantes est hors de
  cette étape de compatibilité.
- Le frontend dépend d'une chaîne `react-scripts` ancienne : son installation a
  signalé 30 vulnérabilités npm (9 faibles, 7 modérées, 14 élevées). `auth` en a
  signalé 4 (3 élevées, 1 critique) et l'API Gateway 1 élevée. Ces vulnérabilités
  doivent être analysées dans une étape dédiée plutôt que corrigées aveuglément.
- Aucun test de connexion PostgreSQL, appel Stripe ou déploiement AWS n'est
  réalisé dans cette étape.

## Résultats locaux

- `node --check` : réussi pour les six fichiers backend inspectés.
- `npm ci` : réussi pour les six composants ; le frontend requiert
  `--legacy-peer-deps`, également utilisé dans son Dockerfile.
- `npm run build` frontend : réussi ; sortie générée dans `build/`.
- `GET /health` local : HTTP 200 avec `{ "status": "ok" }` pour l'API Gateway,
  `auth`, `paie`, `conges` et `recrutement`, sans base ni secret.
- Builds Docker : réussis pour les six images locales `novatech/<composant>:local`.
- Health conteneurisés : HTTP 200 pour les six images. La SPA frontend et Nginx
  ont également répondu HTTP 200 sur `/`.
- Inspection des images : aucun fichier `.env` dans les répertoires applicatifs
  ou servis, et aucune variable sensible préconfigurée dans leurs métadonnées.
- Les six conteneurs temporaires ont été arrêtés et supprimés après validation ;
  les images locales sont conservées pour les validations suivantes.
- Aucun processus Node de test n'est resté actif après les vérifications.
