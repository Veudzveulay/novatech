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

À l'exception du module `ecr`, les modules non encore implémentés restent des
squelettes documentés. Leurs interfaces ne seront complétées qu'avec des besoins
confirmés afin de ne pas inventer de paramètres.

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
