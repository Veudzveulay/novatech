# Blue/Green natif Amazon ECS — Livrable J3

## Statut

Terraform décrit la configuration ci-dessous, mais aucune ressource AWS n'a été
créée et aucun déploiement, basculement ou rollback n'a été testé sur AWS.

## Décision

CodeDeploy n'est finalement pas retenu pour le frontend et l'API Gateway. Le
provider HashiCorp AWS 6.58.0 disponible localement expose la stratégie
`BLUE_GREEN`, le bake time et la configuration avancée du load balancer dans
`aws_ecs_service`. Le mécanisme natif ECS évite les applications et deployment
groups CodeDeploy tout en conservant le contrôleur de déploiement `ECS`.

Le module `codedeploy` reste présent mais inutilisé.

## Routage public

Chaque environnement conserve un seul ALB et un seul listener HTTP 80 :

```text
priorité 10   header X-NovaTech-Preview=api-gateway + /api/* -> api-gateway-green
priorité 20   header X-NovaTech-Preview=frontend + /*        -> frontend-green
priorité 100  /api/*                                      -> api-gateway-blue
priorité 200  /*                                          -> frontend-blue
default                                                   -> réponse fixe HTTP 404
```

Les ARN des deux listener rules sont distincts et fournis respectivement au
service API Gateway et au service frontend. Aucun listener, port public ou ALB
supplémentaire n'est ajouté.

Quatre target groups existent par environnement :

- `frontend-blue` et `frontend-green` ;
- `api-gateway-blue` et `api-gateway-green`.

Chaque règle de production associe les deux target groups dans une action
forward pondérée. Blue possède initialement le poids 1 et Green le poids 0 : un
seul target group reçoit donc du trafic au départ. ECS pourra ensuite modifier
ces poids pendant les déploiements.

Les règles de preview fournissent à ECS les `test_listener_rule` distinctes du
frontend et de l'API Gateway. Le header de preview n'est pas une
authentification : cette solution est limitée au workshop et à des appels
`/health` ou smoke tests non sensibles. Aucune donnée métier sensible ne doit
être appelée par ces règles.

## Services ECS

Le frontend et l'API Gateway utilisent :

- `deployment_controller.type = ECS` (valeur native du service) ;
- `deployment_configuration.strategy = BLUE_GREEN` ;
- un bake time de cinq minutes ;
- le target group alternatif, la listener rule de production et le rôle
  infrastructure dans `load_balancer.advanced_configuration` ;
- la listener rule de test Green dans cette même configuration ;
- deux alarmes de santé CloudWatch avec rollback activé ;
- aucun deployment circuit breaker dans cette première étape.

Le bake time de cinq minutes est un compromis de démonstration et de coût pour
le workshop. Il n'est pas présenté comme optimal pour une vraie production.

`auth`, `paie`, `conges` et `recrutement` conservent la stratégie `ROLLING`, un
minimum sain de 100 %, un maximum de 200 %, le circuit breaker ECS et son
rollback automatique. Ils n'ont aucune configuration ALB avancée.

## Rôle infrastructure ECS

Chaque environnement décrit un rôle dédié partagé par le frontend et l'API
Gateway. Sa relation de confiance autorise uniquement `ecs.amazonaws.com` à
l'assumer. La policy AWS gérée
`AmazonECSInfrastructureRolePolicyForLoadBalancers` lui est attachée ; aucun
`AdministratorAccess` n'est accordé.

Le futur rôle du pipeline GitHub Actions devra recevoir un `iam:PassRole`
strictement ciblé vers ce rôle infrastructure et conditionné au service ECS.
Cette permission n'est pas implémentée dans cette étape.

## Cycle de vie Terraform

Le lifecycle de chaque règle ignore uniquement
`action[0].forward[0].target_group`. Ce chemin couvre les ARN et poids que le
service ECS modifie pendant la bascule ; un futur plan Terraform ne doit donc
pas rétablir blue après un déploiement réussi. Terraform continue de gérer le
type et l'ordre de l'action, la priorité, les conditions et les tags de la
règle. Aucun `ignore_changes = all` n'est utilisé.

## Bascule et rollback restant à démontrer

Le comportement attendu est le suivant : Blue reste actif pendant la création
de Green, Green doit devenir sain avant la bascule, puis Blue reste disponible
pendant le bake time de cinq minutes. Cette configuration prépare un retour
rapide, mais ne prouve ni un rollback automatique ni l'objectif inférieur à dix
minutes.

Avant de revendiquer cet objectif, il reste à configurer les mécanismes de
détection appropriés, ajouter si nécessaire des alarmes CloudWatch, définir un
accès de test à Green, exécuter un scénario d'échec contrôlé sur AWS et conserver
les preuves chronométrées. Aucun de ces tests AWS n'est réalisé ici.

## Détection d'échec préparée

Blue et Green sont des noms physiques de target groups ; leur rôle primaire ou
alternatif peut s'inverser après une bascule. Terraform décrit donc une alarme
`UnHealthyHostCount` pour chacun des quatre groupes. Chaque service ECS surveille
ses deux groupes physiques et demande un rollback si une alarme passe à
`ALARM`.

La statistique est `Maximum`, avec un seuil supérieur ou égal à 1 pendant deux
périodes consécutives de 60 secondes. Les données absentes ne sont pas
considérées comme une panne. Les alarmes HTTP 5xx sont retirées afin de réduire
la complexité du workshop ; la démonstration repose uniquement sur la santé des
cibles et ne prouve pas encore un rollback inférieur à dix minutes.
