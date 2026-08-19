# Pipeline de déploiement J3

## Statut

Le workflow CD est préparé localement mais n'a été exécuté ni sur GitHub
Actions ni sur AWS. Aucun push ECR, changement ECS ou déploiement réel n'est
présenté comme réussi.

## Relation avec la CI J1

`.github/workflows/shipit.yml` orchestre les workflows réutilisables dans cet
ordre strict : Build, Test, Security, puis CD J3. Le job CD dépend de Security
et ne s'exécute que pour un push ou un lancement manuel sur `main`, jamais sur
une pull request.

Dans `.github/workflows/deploy-j3.yml`, la production dépend du smoke test
staging, qui dépend lui-même du déploiement staging. Une erreur Build, Test,
Security, publication ECR, déploiement staging ou smoke staging bloque donc la
production. Les images ne sont construites qu'une fois et la production
réutilise le même tag SHA que staging.

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
- le sujet exact de la branche `main` pour le job de publication ECR ;
- les sujets GitHub `environment:staging` et `environment:production` pour les
  jobs de déploiement associés à ces environnements.

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

### Exception workshop : production HTTP uniquement

La production de démonstration peut temporairement être créée en HTTP avec
`certificate_arn = null`. Ce choix est limité au workshop : aucun domaine
public contrôlé n'est disponible et un certificat ACM public ne peut donc pas
être validé proprement. Il ne constitue pas la cible de sécurité d'une
production réelle.

Le support HTTPS reste présent dans le module ALB. Dès qu'un domaine réel est
disponible, un certificat ACM doit être demandé et validé par DNS dans la même
région que l'ALB. Son ARN est ensuite renseigné dans `certificate_arn` :
Terraform crée alors le listener HTTPS 443 avec la politique
`ELBSecurityPolicy-TLS13-1-2-2021-06`, attache les règles applicatives à ce
listener et transforme le listener HTTP 80 en redirection permanente 301 vers
HTTPS. Aucune logique ACM ne doit être supprimée pour le mode workshop.

### Migration PostgreSQL production

La migration initiale réutilise `db/migrations/001_initial_staging.sql`. Ce
script est transactionnel et idempotent (`CREATE TABLE IF NOT EXISTS` et
`CREATE INDEX IF NOT EXISTS`) ; il ne contient ni `DROP`, ni `TRUNCATE`, ni
suppression de données.

Après création du RDS production et avant les tests métier, elle doit être
exécutée par une tâche ECS ponctuelle dédiée dans le VPC production. La tâche
doit utiliser le groupe de sécurité ECS, injecter l'utilisateur et le mot de
passe depuis le secret maître géré par RDS, et appeler `psql` avec
`ON_ERROR_STOP=1`, `sslmode=verify-full` et le bundle CA RDS `eu-west-3`.
Aucune valeur secrète ne doit apparaître dans la commande ou les logs. Le
déploiement ne poursuit les tests métier qu'après un code de sortie nul et la
vérification non destructive de la présence des tables attendues.

## Variables GitHub nécessaires

Variables de repository non sensibles, requises avant l'authentification AWS :

- `AWS_REGION` : région AWS réelle choisie pour le compte ; les valeurs des
  fichiers `terraform.tfvars.example` sont fictives et ne doivent pas être
  copiées sans confirmation ;
- `AWS_DEPLOY_ROLE_ARN`, alimenté plus tard avec l'output Terraform
  `github_deploy_role_arn` ;
- `PROJECT_NAME`, identique à la variable Terraform `project_name`.

Variables non sensibles des environnements GitHub :

- environnement `staging` : `STAGING_BASE_URL` ;
- environnement `production` : `PRODUCTION_BASE_URL`.

Les environnements GitHub doivent porter exactement les noms `staging` et
`production`. Une règle d'approbation peut être ajoutée à `production` dans les
Settings sans modifier le workflow. Le workflow vérifie explicitement les
variables partagées avant tout appel AWS et chaque URL avant son smoke test.

Les secrets applicatifs restent exclusivement dans AWS Secrets Manager. Aucune
clé AWS longue durée ni aucun secret GitHub n'est requis par ce workflow, et
aucune valeur réelle n'est fournie dans cette documentation.

## État des validations et preuves

Les validations locales de syntaxe, Terraform, tests, audits et images doivent
être consignées avec leur commande et leur résultat réel. Elles ne prouvent pas
un déploiement AWS. Restent nécessairement à exécuter, avec autorisation et sur
le compte cible : création de l'infrastructure, publication ECR, déploiements,
smoke tests sur les URL réelles et démonstration chronométrée du rollback.

## Preuves réelles du workshop — 19 août 2026

Le statut préparatoire ci-dessus décrit l'état initial de la documentation. Les
opérations autorisées du workshop ont depuis apporté les preuves réelles
suivantes, sans destruction d'infrastructure et sans exposition de secret :

- staging déployé et validé, avec six services ECS stables à `1/1` ;
- production déployée et validée sur
  `http://novatech-production-alb-1298473769.eu-west-3.elb.amazonaws.com`, avec
  RDS disponible, migration PostgreSQL non destructive réussie et six services
  ECS stables à `1/1` ;
- les cinq tables attendues ont été vérifiées : `users`, `employees`, `conges`,
  `bulletins_paie` et `candidats` ;
- les smoke tests production ont réussi pour `/health`, Auth, Congés, Paie et
  Recrutement ; `/paie/migrate` et `/conges/debug/all` retournent `404` ;
- les six repositories ECR contiennent les images immuables utilisées par ECS ;
- les conteneurs Secrets Manager JWT et Stripe sont présents avec une version
  `AWSCURRENT`, sans lecture ni journalisation de leur valeur ;
- la production reste volontairement HTTP uniquement pour le workshop, faute
  de domaine ; le chemin HTTPS/ACM décrit plus haut reste intact.

### Démonstration ECS Blue/Green et rollback

Les services publics frontend et API Gateway utilisent la stratégie ECS native
`BLUE_GREEN`, deux target groups, les règles ALB production/test, un bake time
de 5 minutes et le rollback sur alarmes. Les quatre services internes restent
en rolling update avec circuit breaker.

Une révision `novatech-production-frontend-task:2`, identique à la révision
saine et portant seulement le marqueur non fonctionnel
`WORKSHOP_ROLLOUT_ID=bloc4-blue-green-proof`, a été déployée puis ramenée
volontairement à `novatech-production-frontend-task:1` :

- rollout contrôlé : `502,7 s` (8 min 22,7 s), 31 sondes HTTP `/` sur 31 à
  `200` ;
- rollback volontaire : `503,1 s` (8 min 23,1 s), 32 sondes HTTP `/` sur 32 à
  `200` ;
- résultat : rollback inférieur à 10 minutes et aucune interruption observée.

Cette preuve valide un retour manuel contrôlé vers la task definition
précédente. Elle ne constitue pas une démonstration d'échec automatique par
alarme CloudWatch avec une image volontairement défaillante.

### Démonstration du feature flag

L'état initial de `FEATURE_RECRUITMENT_ENABLED` était `true`. Une révision
temporaire de l'API Gateway a placé uniquement ce flag à `false` : après
stabilisation, `/health` répondait `200` et
`/api/recrutement/candidats` répondait `404`. Les 24 sondes de santé du rollout
ont toutes répondu `200`.

La révision d'origine avec le flag à `true` a ensuite été restaurée. Après
stabilisation, `/health` et `/api/recrutement/candidats` répondaient `200` ; les
23 sondes de santé de la réactivation ont toutes répondu `200`. L'état final du
feature flag est donc `true`.

### État du pipeline GitHub Actions

La configuration locale a été vérifiée : `shipit.yml` impose Build, Test puis
Security avant le CD ; `deploy-j3.yml` construit et pousse les six images au
même tag SHA, déploie staging, exécute ses smoke tests, puis déploie production
et exécute ses smoke tests. L'authentification utilise GitHub OIDC. Aucun push
ni workflow GitHub Actions n'a été déclenché pendant cette démonstration ; les
preuves AWS ci-dessus résultent des opérations contrôlées du workshop et non
d'un run complet du pipeline GitHub.
