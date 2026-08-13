# Terraform — Livrable J3

Ce dossier prépare l'Infrastructure as Code du livrable J3. À cette étape, il
décrit les repositories ECR, mais aucune ressource correspondante n'a été créée
sur AWS et ce code ne constitue pas une preuve de déploiement.

## Modules prévus

- `network` : VPC, sous-réseaux publics et privés, et routage sans NAT.
- `ecr` : repositories des six composants et politiques de cycle de vie.
- `alb` : Application Load Balancer, listeners, règles et target groups.
- `ecs-service` : cluster, task definitions, services Fargate et journaux.
- `database` : base PostgreSQL RDS, subnet group et protections associées.
- `secrets` : conteneurs Secrets Manager et droits d'accès minimaux.
- `codedeploy` : déploiements Blue/Green et rollback applicatif.
- `budget` : budget AWS et seuils d'alerte adaptés à la limite du workshop.

À l'exception des modules `ecr`, `alb` et `ecs-service`, les modules non encore
implémentés restent des squelettes documentés. Leurs interfaces ne seront
complétées qu'avec des besoins confirmés afin de ne pas inventer de paramètres.

### Repositories ECR partagés

Le module `ecr` décrit exactement six repositories, nommés avec la convention
`<project_name>/<component>` :

- `frontend` ;
- `api-gateway` ;
- `auth` ;
- `paie` ;
- `conges` ;
- `recrutement`.

Ces repositories sont communs à staging et production. Ils sont instanciés une
seule fois par le root `shared`, qui appelle uniquement le module ECR à cette
étape et ne configure volontairement aucun backend distant. Les roots
`environments/staging` et `environments/production` ne créent donc aucun
repository ECR et ne risquent pas de se concurrencer sur les mêmes ressources.

Chaque repository impose des tags immuables, active le scan au push et utilise
le chiffrement AES-256 géré par AWS, suffisant pour le workshop sans coût ni
gestion d'une clé KMS dédiée. Les images déployables devront porter un tag
`sha-<git-sha>` ; `latest` est volontairement absent de la stratégie de
déploiement. La production devra promouvoir le même tag SHA ou digest que celui
validé en staging, sans reconstruire l'image.

Une lifecycle policy par repository supprime les images non taguées après trois
jours et conserve les dix images taguées `sha-` les plus récentes. Cette
rétention simple limite le stockage ECR et contribue au respect du budget de
50 euros. Le code décrit six repositories et six lifecycle policies potentiels,
mais leur existence sur AWS ne pourra être affirmée qu'après une opération
autorisée et démontrée.

### Réseau du workshop

Le module `network` définit un VPC avec DNS activé et répartit deux subnets
publics et deux subnets privés sur deux zones de disponibilité configurables.
Les subnets publics disposent d'une route vers une Internet Gateway et sont
destinés au futur ALB. Les subnets privés n'ont aucune route Internet et sont
destinés à PostgreSQL.

Aucun NAT Gateway ni NAT Instance n'est prévu afin de respecter le budget AWS
maximal de 50 €. Pour le workshop, les futures tâches ECS qui nécessitent un
accès sortant pourront être placées dans les subnets publics avec une IP
publique, tout en étant protégées en entrée par des Security Groups à définir
dans une étape distincte. Ce compromis réduit le coût mais offre moins
d'isolation qu'une architecture de production réelle, où les tâches seraient
placées dans des subnets privés avec des VPC endpoints ou une sortie NAT
contrôlée. Le code Terraform décrit seulement cette cible : aucune de ces
ressources n'est déclarée comme déjà créée sur AWS.

### Cloisonnement par Security Groups

Le module `security-groups` décrit trois groupes distincts, sans accès SSH :

```text
Internet --TCP/80--> ALB SG --TCP/80,3000--> ECS SG
                                  ECS SG --TCP/3001-3004--> ECS SG
                                  ECS SG --TCP/5432--> Database SG
```

Le futur ALB accepte uniquement HTTP 80 depuis Internet à ce stade ; HTTPS 443
attend la confirmation du domaine et du certificat TLS. Le frontend sur 80 et
l'API Gateway sur 3000 n'acceptent que le Security Group de l'ALB. Les services
`auth`, `paie`, `conges` et `recrutement`, sur les ports 3001 à 3004, ne sont
accessibles que par les tâches partageant le Security Group ECS. PostgreSQL sur
5432 n'accepte que ce même Security Group ECS. Aucun port applicatif interne,
PostgreSQL ou SSH n'est exposé publiquement.

L'egress de l'ALB est limité aux ports applicatifs du Security Group ECS. Pour
le workshop sans NAT Gateway, l'egress IPv4 des tâches ECS reste volontairement
large afin de permettre PostgreSQL, ECR et les API externes. Une production
réelle devrait le resserrer avec des règles ciblées, des tâches en subnets
privés et des VPC endpoints ou une sortie NAT contrôlée. Ces groupes sont
uniquement décrits par Terraform et ne sont pas déclarés comme existants sur
AWS.

### Application Load Balancer

Le module `alb` décrit un Application Load Balancer public distinct dans chaque
environnement, réparti sur les deux subnets publics et associé au Security Group
ALB existant. Seuls le frontend et l'API Gateway possèdent des target groups
publics ; `auth`, `paie`, `conges` et `recrutement` restent internes.

Le listener HTTP 80 envoie par défaut le trafic vers le frontend. Une règle de
priorité 100 route `/api/*` vers l'API Gateway, conformément aux routes
réellement déclarées par l'application. HTTPS n'est pas configuré tant qu'aucun
domaine ni certificat ACM n'est confirmé.

Les target groups utilisent `target_type = "ip"`, requis pour les futures tâches
ECS Fargate en mode réseau `awsvpc`. L'API Gateway est contrôlée sur `/health`
avec un matcher HTTP 200. Le frontend ne possède encore ni image Nginx ni route
`/health` confirmée : son contrôle utilise provisoirement `/`, chemin réel de la
SPA et variable du module. Il devra être remplacé par `/health` dès que la
configuration Nginx correspondante sera implémentée et testée.

Deux target groups, blue et green, sont décrits pour chacun des deux composants
publics. Le listener cible initialement les groupes blue ; les groupes green
restent disponibles pour une future orchestration CodeDeploy sans imposer une
refonte du module ALB. Aucun CodeDeploy ni basculement Blue/Green n'est configuré
à cette étape.

Cette séparation prévoit potentiellement deux ALB facturés en continu, un pour
staging et un pour production, en plus des unités de capacité consommées. Elle
coûte davantage qu'un ALB partagé mais préserve l'isolation exigée entre les
environnements. Le coût devra être estimé dans la région choisie avant toute
création, et staging devra être conservé le moins longtemps possible pour rester
dans le budget total de 50 euros. Aucun ALB ni target group n'a été créé sur AWS.

### Socle ECS Fargate

Chaque environnement décrit son propre cluster ECS et six services Fargate :
`frontend`, `api-gateway`, `auth`, `paie`, `conges` et `recrutement`. Le module
`ecs-service`, appelé avec `for_each`, crée pour chaque composant une task
definition `awsvpc`, un service et un groupe CloudWatch Logs. Chaque tâche est
dimensionnée à 256 unités CPU et 512 MiB, avec un exemplaire souhaité pour le
workshop. Les ports sont strictement 80, 3000, 3001, 3002, 3003 et 3004 dans
l'ordre des composants précédent.

Les groupes de logs suivent `/<project_name>/<environment>/<component>` avec
sept jours de rétention. Les task definitions activent `awslogs` et ne
contiennent aucune variable sensible. Un rôle IAM d'exécution est partagé par
les six tâches d'un environnement et reçoit uniquement la politique AWS standard
permettant notamment le pull ECR et l'écriture des logs. Aucun task role métier,
droit RDS ou droit Secrets Manager n'est ajouté.

Les URI d'images arrivent par la variable `image_uris`, qui exige exactement les
six composants et refuse `latest`. Les vraies valeurs devront utiliser
`<repository-url>:sha-<git-sha>` ou un digest ECR ; les fichiers d'exemple ne
contiennent que des comptes et tags fictifs. Staging et production ne dépendent
pas directement du root ECR partagé.

La découverte interne utilise AWS Cloud Map, solution DNS simple pour les
services Fargate. Chaque environnement possède un namespace privé
`<environment>.<project_name>.local`. Seuls `auth`, `paie`, `conges` et
`recrutement` y sont enregistrés. L'API Gateway reçoit `AUTH_SERVICE_URL`,
`PAIE_SERVICE_URL`, `CONGES_SERVICE_URL` et `RECRUTEMENT_SERVICE_URL`, en plus de
`NODE_ENV` et `PORT`. Les autres composants reçoivent uniquement `NODE_ENV` et
`PORT`. Le code applicatif doit encore être adapté pour lire ces variables au
lieu des valeurs actuellement codées en dur.

Le frontend est rattaché uniquement au target group frontend blue et l'API
Gateway uniquement au target group API Gateway blue. Les quatre services métier
n'ont aucun bloc load balancer et restent inaccessibles depuis l'ALB. Les target
groups green ne sont pas utilisés avant l'étape CodeDeploy.

Les services utilisent pour l'instant le contrôleur de déploiement ECS avec
minimum sain à 100 %, maximum à 200 % et circuit breaker avec rollback. Passer
frontend et API Gateway au contrôleur `CODE_DEPLOY` est volontairement différé
jusqu'à la création cohérente des applications et deployment groups CodeDeploy ;
les interfaces ALB blue/green évitent une refonte des target groups.

Pour éviter un NAT Gateway durant le workshop, les tâches utilisent les subnets
publics avec `assign_public_ip = true`. Le Security Group ECS reste la barrière
d'entrée : cette configuration ne rend pas les services métier accessibles par
l'ALB. Une production réelle devrait placer les tâches dans des subnets privés,
avec des VPC endpoints ou une sortie NAT contrôlée. Les six tâches Fargate, leurs
IPv4 publiques et les logs sont susceptibles d'être facturés et doivent rester
actifs le moins longtemps possible dans la limite de 50 euros.

RDS et Secrets Manager ne sont pas intégrés à cette étape. Les services qui en
dépendent ne sont donc pas prêts à fonctionner réellement. De plus, `/health`
n'est toujours pas confirmé pour `auth`, `paie`, `conges` et `recrutement`, et
aucune route n'est inventée par Terraform. Toutes les ressources ECS décrites
restent potentielles : aucun cluster, service, rôle, namespace, log group ou
task definition n'a été créé sur AWS.

## Environnements

`environments/staging` et `environments/production` sont des racines Terraform
séparées. Leurs variables, états, secrets et futures ressources doivent rester
isolés. Les artefacts applicatifs sont construits une fois : production doit
promouvoir les mêmes images et digests ECR tagués avec le SHA Git qui ont été
validés en staging, sans reconstruction et sans utiliser `latest`.

`shared` est une troisième racine Terraform, indépendante des environnements,
réservée aux ressources communes. Elle gère uniquement ECR à cette étape et
expose les URLs, ARN et noms complets des repositories sous forme de maps
indexées par composant pour les futurs workflows et task definitions ECS.

La région, les zones de disponibilité, les CIDR et le backend d'état définitifs
restent à confirmer. Aucun credential AWS n'est configuré dans ce dépôt.

## Validation locale autorisée

Depuis la racine du dépôt :

```powershell
terraform fmt -recursive infra/terraform
terraform -chdir=infra/terraform/shared init -backend=false
terraform -chdir=infra/terraform/shared validate
terraform -chdir=infra/terraform/environments/staging init -backend=false
terraform -chdir=infra/terraform/environments/staging validate
terraform -chdir=infra/terraform/environments/production init -backend=false
terraform -chdir=infra/terraform/environments/production validate
```

Ces commandes servent uniquement au formatage, à l'initialisation locale des
providers et à la validation syntaxique. Elles ne prouvent aucun déploiement.

## Commandes soumises à validation humaine

Une autorisation humaine est obligatoire avant tout `terraform plan` connecté
à AWS, `terraform apply`, `terraform destroy`, appel AWS, push ECR, déploiement
ECS, déploiement staging ou production, et rollback. Toute future ressource
payante doit être signalée avant sa création. Le budget AWS maximal est de
50 € ; aucun NAT Gateway ne doit être ajouté sans autorisation.

## Fichiers locaux à ne jamais commiter

Les états Terraform (`*.tfstate` et dérivés), dossiers `.terraform/`, plans,
fichiers de crash et vrais fichiers `.tfvars` ne doivent jamais être commités.
Seuls les fichiers `terraform.tfvars.example`, explicitement fictifs et sans
secret, sont destinés au dépôt. Les protections `.gitignore` doivent être en
place avant de créer de vrais fichiers de variables ou des états locaux.
