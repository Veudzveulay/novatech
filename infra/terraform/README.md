# Terraform — Livrable J3

Ce dossier prépare l'Infrastructure as Code du livrable J3. À cette étape, il
ne contient aucune ressource AWS et ne constitue donc pas une preuve de
déploiement.

## Modules prévus

- `network` : VPC, sous-réseaux, routage et groupes de sécurité.
- `ecr` : repositories des six composants et politiques de cycle de vie.
- `alb` : Application Load Balancer, listeners, règles et target groups.
- `ecs-service` : cluster, task definitions, services Fargate et journaux.
- `database` : base PostgreSQL RDS, subnet group et protections associées.
- `secrets` : conteneurs Secrets Manager et droits d'accès minimaux.
- `codedeploy` : déploiements Blue/Green et rollback applicatif.
- `budget` : budget AWS et seuils d'alerte adaptés à la limite du workshop.

Chaque module est actuellement un squelette documenté. Les interfaces ne seront
complétées qu'avec des besoins confirmés afin de ne pas inventer de paramètres.

## Environnements

`environments/staging` et `environments/production` sont des racines Terraform
séparées. Leurs variables, états, secrets et futures ressources doivent rester
isolés. Les artefacts applicatifs sont construits une fois : production doit
promouvoir les mêmes images et digests ECR tagués avec le SHA Git qui ont été
validés en staging, sans reconstruction et sans utiliser `latest`.

La région, les zones de disponibilité, les CIDR et le backend d'état définitifs
restent à confirmer. Aucun credential AWS n'est configuré dans ce dépôt.

## Validation locale autorisée

Depuis la racine du dépôt :

```powershell
terraform fmt -recursive infra/terraform
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
