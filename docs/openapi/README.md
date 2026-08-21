# Documentation API HRFlow — OpenAPI + Swagger UI (L4)

Spécification OpenAPI 3.0 des 4 services métier, plus une Swagger UI pour les
parcourir.

## Contenu

| Fichier | Service | Endpoints documentés |
|---|---|---|
| `auth.openapi.yaml` | Auth | `/auth/login`, `/auth/verify`, `/health`, `/metrics` |
| `paie.openapi.yaml` | Paie | `/paie/calculer`, `/paie/heures-sup`, `/health`, `/metrics` |
| `conges.openapi.yaml` | Congés | `/conges/solde/{id}`, `/conges/demande`, `/health`, `/metrics` |
| `recrutement.openapi.yaml` | Recrutement | `/recrutement/candidat` (POST/GET/PATCH), `/health`, `/metrics` |
| `index.html` | — | Swagger UI, sélecteur des 4 services |

Les specs décrivent l'API **réellement déployée** (après remédiation) : les
routes retirées pour raison de sécurité — `/paie/migrate` (VULN-04) et
`/conges/debug/all` (VULN-06) — n'y figurent pas.

## Consulter la doc

Les chemins des specs sont relatifs, il faut donc servir le dossier (pas
`file://`) :

```bash
# depuis la racine du dépôt
npx --yes http-server docs/openapi -p 8088
# puis ouvrir http://localhost:8088
```

La Swagger UI charge ses assets depuis unpkg (CDN) : une connexion internet est
nécessaire à l'affichage.

## Accès public via la passerelle

Les chemins documentés sont ceux de chaque service. Publiquement, ils passent
par l'API Gateway sous le préfixe `/api/<service>` : la passerelle retire `/api`
avant de relayer. Exemple : `POST /api/auth/login` (public) → `POST /auth/login`
(service auth).

## Servir la Swagger UI depuis l'application (option)

Pour une Swagger UI servie par la passerelle plutôt qu'en statique, ajouter
`swagger-ui-express` à l'API Gateway. Non fait ici pour ne pas modifier la
passerelle en dehors de son périmètre — à décider avec l'équipe.
