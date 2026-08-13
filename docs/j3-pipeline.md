# Pipeline de déploiement J3

## Statut

Le workflow CD est préparé localement mais n'a été exécuté ni sur GitHub
Actions ni sur AWS. Aucun push ECR, changement ECS ou déploiement réel n'est
présenté comme réussi.

## Relation avec la CI J1

Le dépôt ne contient actuellement aucun workflow CI J1 exploitable. Le seul
workflow trouvé était l'ancien déploiement SSH de 2021. Pour ne pas inventer le
nom ou les jobs de J1, le nouveau fichier `.github/workflows/deploy-j3.yml` est
un workflow réutilisable déclenché exclusivement par `workflow_call`.

Après les jobs Build, Test et Security réussis sur `main`, la future CI J1 devra
ajouter un job de cette forme :

```yaml
deploy-j3:
  if: github.ref == 'refs/heads/main'
  needs: [build, test, security]
  permissions:
    id-token: write
    contents: read
  uses: ./.github/workflows/deploy-j3.yml
```

Les noms de `needs` devront reprendre les identifiants réels de la CI J1. Cette
jonction rendra le chemin automatique sans approbation entre staging et
production. Elle n'est pas ajoutée tant que J1 n'est pas présent dans ce dépôt.

## Ancien déploiement SSH

`.github/workflows/deploy.yml` est conservé pour rendre l'historique visible,
mais il ne réagit plus aux pushes sur `main`. Son déclencheur est manuel et son
job est explicitement désactivé par une condition fausse. Il ne peut donc pas
déployer en parallèle du CD ECS. `scripts/deploy.sh` n'est ni appelé ni modifié.

## Authentification OIDC

Le root Terraform `shared` décrit le fournisseur GitHub
`https://token.actions.githubusercontent.com` et un rôle de déploiement. La
confiance vérifie :

- l'audience `sts.amazonaws.com` ;
- le repository fourni par `github_repository` au format `owner/repository` ;
- le sujet exact de la branche `main`.

Le workflow utilise `id-token: write`, `contents: read` et
`aws-actions/configure-aws-credentials`. Aucune clé AWS longue durée n'est
attendue dans GitHub.

## Permissions AWS

Le rôle autorise :

- `ecr:GetAuthorizationToken` sur `*`, car cette action d'authentification ne
  prend pas en charge une restriction à un repository ;
- les actions d'upload uniquement sur les six ARN ECR gérés par `shared` ;
- `ecs:DescribeServices` et `ecs:UpdateService` sur les douze services nommés ;
- `ecs:DescribeTaskDefinition` et `ecs:RegisterTaskDefinition` sur `*`, car
  l'enregistrement d'une nouvelle task definition ne dispose pas encore d'un
  ARN de ressource et ces actions ne permettent pas une restriction utile au
  jeu d'ARN futurs ;
- `iam:PassRole` sur les seuls rôles d'exécution ECS et infrastructure ECS de
  staging/production, avec `iam:PassedToService` limité respectivement à
  `ecs-tasks.amazonaws.com` et `ecs.amazonaws.com`.

Aucun `AdministratorAccess` n'est attaché.

## Construction et ECR

Les six images sont construites une seule fois depuis leurs contextes validés :

- `frontend/` ;
- `services/api-gateway/` ;
- `services/auth/` ;
- `services/paie/` ;
- `services/conges/` ;
- `services/recrutement/`.

Le tag immuable est `sha-${{ github.sha }}` avec le SHA complet. Le registre
provient de la connexion ECR et les repositories suivent
`<PROJECT_NAME>/<component>`. Aucun compte AWS n'est codé en dur et `latest`
n'est jamais utilisé.

## Déploiement staging

Pour chaque composant, le workflow lit la task definition actuelle, remplace
uniquement l'image du conteneur portant le nom du composant, retire les champs
AWS non réenregistrables, crée une révision puis met à jour le service. Les
secrets et variables existants sont conservés sans que leur valeur soit lue ou
affichée.

Le waiter AWS `ecs wait services-stable` remplace un délai fixe. Les smoke tests
suivants doivent ensuite réussir :

- `GET <STAGING_BASE_URL>/health` ;
- `OPTIONS <STAGING_BASE_URL>/api/recrutement/candidats`.

Aucune donnée métier n'est lue ou modifiée.

## Production et Blue/Green

Le job production dépend explicitement de `smoke-staging` et réutilise les six
images déjà poussées avec le même tag SHA. Aucune reconstruction n'a lieu.

Le workflow met seulement à jour les task definitions et services. ECS applique
la stratégie déjà déclarée par Terraform : Blue/Green natif pour frontend et
API Gateway, rolling avec circuit breaker pour les quatre services internes.
Après stabilité, les deux mêmes catégories de smoke tests non destructifs sont
exécutées sur `PRODUCTION_BASE_URL`.

Le scénario volontaire de panne et le rollback chronométré restent séparés du
pipeline normal et sont décrits dans `j3-rollback-runbook.md`.

## Variables GitHub nécessaires

Variables de repository non sensibles :

- `AWS_REGION` ;
- `AWS_DEPLOY_ROLE_ARN`, alimenté plus tard avec l'output Terraform
  `github_deploy_role_arn` ;
- `PROJECT_NAME` ;
- `STAGING_BASE_URL` ;
- `PRODUCTION_BASE_URL`.

Les secrets applicatifs restent exclusivement dans AWS Secrets Manager. Aucune
valeur réelle n'est fournie dans cette documentation.
