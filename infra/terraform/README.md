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
- `codedeploy` : squelette conservé mais non utilisé ; le Blue/Green est géré nativement par ECS.
- `budget` : budget AWS et seuils d'alerte adaptés à la limite du workshop.

À l'exception des modules `ecr`, `alb`, `ecs-service`, `database` et `secrets`, les modules
non encore implémentés restent des squelettes documentés. Leurs interfaces ne
seront complétées qu'avec des besoins confirmés afin de ne pas inventer de
paramètres.

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

Le listener HTTP 80 possède deux règles de production distinctes : priorité 100
pour `/api/*` vers l'API Gateway blue, puis priorité 200 pour `/*` vers le
frontend blue. Son action par défaut est une réponse fixe HTTP 404. Cette
structure fournit à ECS un ARN de listener rule propre à chaque service, sans
second ALB ni port public supplémentaire. HTTPS n'est pas configuré tant
qu'aucun domaine ni certificat ACM n'est confirmé.

Les target groups utilisent `target_type = "ip"`, requis pour les futures tâches
ECS Fargate en mode réseau `awsvpc`. L'API Gateway et le frontend Nginx sont
contrôlés sur `/health` avec un matcher HTTP 200, conformément aux validations
applicatives et Docker locales.

Deux target groups, blue et green, sont décrits pour chacun des deux composants
publics. Chaque règle de production associe les deux groupes dans une action
forward pondérée : blue possède initialement le poids 1 et green le poids 0. Il
y a donc exactement un groupe recevant du trafic. Les groupes green sont aussi
déclarés comme groupes alternatifs dans la configuration Blue/Green native des
services ECS.

Deux règles de preview de priorités 10 et 20 précèdent les règles de production.
Elles combinent le header `X-NovaTech-Preview` avec le chemin du composant et
envoient initialement le trafic vers Green. Leurs ARN sont fournis à ECS comme
`test_listener_rule`. Ce header n'est pas une authentification : il est adapté
uniquement au workshop et aux health/smoke tests sans donnée sensible.

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
contiennent aucune valeur sensible. Un rôle IAM d'exécution est partagé par les
six tâches d'un environnement ; ses droits Secrets Manager ciblés sont décrits
plus bas. Aucun task role métier ni droit d'accès direct à RDS n'est ajouté.

Les URI d'images arrivent par la variable `image_uris`, qui exige exactement les
six composants et refuse `latest`. Les vraies valeurs devront utiliser
`<repository-url>:sha-<git-sha>` ou un digest ECR ; les fichiers d'exemple ne
contiennent que des comptes et tags fictifs. Staging et production ne dépendent
pas directement du root ECR partagé.

L'API Gateway reçoit aussi le flag non sensible
`FEATURE_RECRUITMENT_ENABLED`, piloté par la variable booléenne
`feature_recruitment_enabled` propre à chaque environnement. La valeur initiale
est `true`; la passer à `false` bloque temporairement les routes recrutement.
Comme la valeur appartient à la task definition, tout changement nécessite une
nouvelle révision et un redéploiement du Gateway. Un mécanisme dynamique tel
qu'AWS AppConfig reste une amélioration future et n'est pas implémenté ici.

La découverte interne utilise AWS Cloud Map, solution DNS simple pour les
services Fargate. Chaque environnement possède un namespace privé
`<environment>.<project_name>.local`. Seuls `auth`, `paie`, `conges` et
`recrutement` y sont enregistrés. L'API Gateway reçoit `AUTH_SERVICE_URL`,
`PAIE_SERVICE_URL`, `CONGES_SERVICE_URL` et `RECRUTEMENT_SERVICE_URL`, en plus de
`NODE_ENV` et `PORT`. Les variables de connexion à PostgreSQL et les références
Secrets Manager sont décrites dans la section suivante. Le code applicatif doit
encore être adapté pour lire les URL de services au lieu des valeurs actuellement
codées en dur.

Le frontend et l'API Gateway conservent le contrôleur `ECS` et utilisent la
stratégie native `BLUE_GREEN`. Chacun déclare son target group blue principal,
son target group green alternatif et sa listener rule de production. Le bake
time est fixé à cinq minutes dans staging et production : c'est un compromis de
démonstration et de coût, pas une durée déclarée optimale pour une vraie
production. Aucun circuit breaker n'est configuré pour ces deux services à ce
stade.

Les noms blue et green désignent des target groups physiques ; leur rôle
primaire ou alternatif peut changer au fil des déploiements. Chacun des quatre
target groups possède donc une alarme `UnHealthyHostCount`. Deux périodes
consécutives de 60 secondes avec au moins une cible unhealthy sont requises, et
les données absentes restent non alarmantes. Chaque service public transmet ses
deux alarmes au bloc ECS `alarms`, avec rollback activé. Les alarmes 5xx sont
volontairement retirées pour conserver un livrable de workshop essentiel.

Les quatre services internes utilisent `ROLLING`, avec minimum sain à 100 %,
maximum à 200 %, circuit breaker et rollback automatique. Ils n'ont ni load
balancer, ni target group alternatif, ni `advanced_configuration`.

Chaque environnement crée un rôle infrastructure partagé par le frontend et
l'API Gateway. Sa confiance est limitée à `ecs.amazonaws.com` et la policy AWS
gérée `AmazonECSInfrastructureRolePolicyForLoadBalancers` lui permet de gérer
les ressources ALB nécessaires. Le futur acteur de déploiement devra disposer
d'un `iam:PassRole` ciblé vers ce rôle ; cette permission de pipeline n'est pas
encore créée.

ECS orchestre les poids des target groups pendant les déploiements. Le lifecycle
des deux règles ignore donc uniquement
`action[0].forward[0].target_group`, afin qu'un futur plan Terraform ne remette
pas arbitrairement le trafic sur blue après une bascule réussie. Terraform
continue de gérer le type et l'ordre de l'action, la priorité, les conditions et
les tags ; aucun `ignore_changes = all` n'est utilisé.

Pour éviter un NAT Gateway durant le workshop, les tâches utilisent les subnets
publics avec `assign_public_ip = true`. Le Security Group ECS reste la barrière
d'entrée : cette configuration ne rend pas les services métier accessibles par
l'ALB. Une production réelle devrait placer les tâches dans des subnets privés,
avec des VPC endpoints ou une sortie NAT contrôlée. Les six tâches Fargate, leurs
IPv4 publiques et les logs sont susceptibles d'être facturés et doivent rester
actifs le moins longtemps possible dans la limite de 50 euros.

RDS et Secrets Manager sont désormais référencés par les task definitions. Les
adaptations applicatives encore requises sont détaillées ci-dessous. `/health`
n'est toujours pas confirmé pour `auth`, `paie`, `conges` et `recrutement`, et
aucune route n'est inventée par Terraform. Toutes les ressources ECS décrites
restent potentielles : aucun cluster, service, rôle, namespace, log group ou
task definition n'a été créé sur AWS.

### Secrets Manager et injection ECS

Chaque environnement décrit deux conteneurs Secrets Manager applicatifs séparés,
nommés `<project_name>/<environment>/jwt-secret` et
`<project_name>/<environment>/stripe-secret-key`. Terraform ne crée aucune
version et ne reçoit aucune valeur : un opérateur devra renseigner ces deux
conteneurs hors Terraform avant tout démarrage des tâches. Staging et production
ont des conteneurs et des valeurs indépendants.

Le mot de passe PostgreSQL n'est pas dupliqué. Le module ECS réutilise le secret
maître que RDS crée grâce à `manage_master_user_password = true`. Les services
concernés reçoivent `DB_USER` et `DB_PASSWORD` via les clés JSON `username` et
`password` de ce secret ; `DB_HOST`, `DB_PORT` et `DB_NAME`, qui ne sont pas
sensibles, restent des variables d'environnement ordinaires. `auth` et l'API
Gateway reçoivent `JWT_SECRET`, tandis que `paie` reçoit `STRIPE_SECRET_KEY`
depuis les conteneurs applicatifs.

Le code `auth` consomme déjà les cinq variables `DB_*`. En revanche, `paie`,
`conges` et `recrutement` consomment actuellement une variable unique
`DATABASE_URL`. Avant un déploiement fonctionnel, ces trois services devront être
adaptés pour construire leur connexion à partir de `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER` et `DB_PASSWORD`. Cette adaptation évite de stocker une
seconde copie du mot de passe RDS dans un secret `DATABASE_URL`. Le code contient
également des valeurs sensibles de repli et journalise actuellement
`JWT_SECRET` ; ces comportements devront être supprimés avant tout déploiement,
mais aucune modification JavaScript n'est incluse dans cette étape Terraform.

Le rôle d'exécution ECS conserve la politique AWS standard pour ECR et les logs,
et reçoit uniquement `secretsmanager:GetSecretValue` sur les ARN exacts des deux
conteneurs applicatifs et du secret maître RDS de son environnement. Aucun joker
n'est utilisé. Aucun droit `kms:Decrypt` supplémentaire n'est nécessaire tant
que ces secrets utilisent les clés gérées par AWS ; l'adoption future d'une clé
KMS gérée par le projet imposerait une autorisation ciblée sur son ARN.

Cette évolution décrit potentiellement deux conteneurs Secrets Manager et une
politique IAM inline supplémentaires par environnement, soit six ressources
Terraform gérées au total. Les conteneurs Secrets Manager peuvent être facturés
une fois créés. Aucune ressource ni valeur de secret n'a été créée sur AWS par
les validations locales décrites ici.

### Base PostgreSQL RDS

Le module `database` décrit une instance Amazon RDS PostgreSQL propre à chaque
environnement. Staging et production ne partagent donc ni instance, ni base, ni
DB subnet group, ni secret maître. Chaque DB subnet group utilise uniquement les
deux subnets privés de son VPC. L'instance refuse l'accès public et utilise le
Security Group database, qui n'autorise PostgreSQL 5432 que depuis le Security
Group ECS.

Le stockage est de type `gp3`, chiffré au repos et configurable à partir du
minimum de 20 GiB retenu pour le workshop. Les exemples utilisent une petite
classe `db.t4g.micro`, en Single-AZ. Aucune version PostgreSQL n'est figée : la
version par défaut proposée par RDS devra être confirmée avant un futur
déploiement autorisé. Une architecture de production réelle devrait fixer une
version testée, réévaluer la classe et le stockage, et utiliser Multi-AZ selon
les exigences de disponibilité.

Le provider AWS 6.58.0 installé expose `manage_master_user_password`. Le module
l'active afin que RDS génère et conserve le mot de passe maître dans AWS Secrets
Manager. Aucun mot de passe n'entre dans Git, Terraform ou les exemples. Seul
l'ARN calculé du secret est exposé pour une future étape d'injection ECS ; sa
valeur n'est jamais sortie.

Les sauvegardes automatiques sont activées par une rétention strictement
positive : un jour dans l'exemple staging et sept jours dans l'exemple
production. Cela remplace la dépendance exclusive à un backup manuel constatée
lors de l'incident P1 et prépare une restauration à un instant dans la fenêtre
de rétention prise en charge par RDS. Aucune restauration n'a toutefois été
exécutée ou démontrée.

Pour faciliter le nettoyage du sandbox, staging désactive la protection de
suppression et autorise l'absence de snapshot final. L'exemple production active
la protection et exige un snapshot final. Ces choix restent configurables et
doivent être revus avant toute création. Deux instances facturées en continu
peuvent peser fortement sur le budget de 50 euros : les petites classes,
Single-AZ et une durée de vie courte du sandbox constituent un compromis de
workshop, pas une architecture de production hautement disponible. Aucun RDS,
subnet group, secret maître ou backup n'a été créé ni testé sur AWS.

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
