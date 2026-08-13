# Feature flag recrutement — Livrable J3

## Contrat

Le flag non sensible `FEATURE_RECRUITMENT_ENABLED` contrôle uniquement l'accès
aux routes `/api/recrutement` dans l'API Gateway.

- `true` : le Gateway transmet normalement la requête au service recrutement ;
- `false` : le Gateway bloque la requête avant le proxy et répond HTTP 503 avec
  `{ "error": "Feature temporarily unavailable" }` ;
- variable absente : la fonctionnalité reste activée afin de préserver le
  comportement du développement local.

Le statut 503 représente une indisponibilité temporaire d'une fonctionnalité
existante. Le contrôle ne modifie ni `/health`, ni les routes auth, paie ou
congés, ni l'authentification JWT, ni le code métier de recrutement.

## Intégration ECS

Staging et production exposent chacun la variable Terraform booléenne
`feature_recruitment_enabled`, configurée initialement à `true`. Terraform la
convertit en chaîne et injecte `FEATURE_RECRUITMENT_ENABLED` uniquement dans les
variables non sensibles du conteneur API Gateway.

Pour démontrer la désactivation dans un environnement, définir temporairement :

```hcl
feature_recruitment_enabled = false
```

Une modification de cette valeur produit une nouvelle task definition ECS et
nécessite donc un redéploiement du service Gateway. Aucun changement Terraform
connecté à AWS ni déploiement n'a été exécuté dans cette étape.

## Démonstration locale

1. démarrer le Gateway avec `FEATURE_RECRUITMENT_ENABLED=false` ;
2. vérifier que `/health` répond HTTP 200 ;
3. appeler une route `/api/recrutement/*` et vérifier le HTTP 503 ainsi que le
   JSON minimal, même si le service recrutement est indisponible ;
4. redémarrer avec `FEATURE_RECRUITMENT_ENABLED=true` ;
5. vérifier que `/health` répond toujours HTTP 200 et que la même route atteint
   le proxy vers un service recrutement local de test.

Les résultats ne doivent être présentés comme validés qu'après exécution réelle,
localement et dans l'image `novatech/api-gateway:local`.

## Limite et évolution possible

Ce mécanisme est un feature flag piloté par configuration, adapté au workshop
mais non dynamique. AWS AppConfig ou un gestionnaire de flags dédié permettrait
ultérieurement de changer l'état sans enregistrer une nouvelle task definition.
AWS AppConfig n'est pas implémenté dans ce livrable.

## Résultats locaux

- Syntaxe Node du Gateway : valide.
- Flag `false`, processus local : `/health` HTTP 200 et route recrutement HTTP
  503 avec le JSON attendu, sans service recrutement démarré.
- Flag `true`, processus local : `/health` HTTP 200 et requête transmise au
  proxy. Avec le service recrutement actuel, la route de test renvoie ensuite
  HTTP 404 en raison de la réécriture de chemin historique, hors périmètre du
  flag ; elle n'est pas bloquée par le middleware 503.
- Image `novatech/api-gateway:local` : reconstruction réussie.
- Flag `false`, conteneur : `/health` HTTP 200 et recrutement HTTP 503 avant une
  cible volontairement indisponible.
- Flag `true`, conteneur : `/health` HTTP 200 et proxy HTTP 200 vers une cible
  locale temporaire.
- Tous les conteneurs et réseaux temporaires de cette démonstration ont été
  supprimés. Aucun test AWS n'a été exécuté.
