# Instructions Codex — NovaTech HRFlow

## Contexte

Projet évaluatif BC03 ShipIt portant sur la transformation de la chaîne
de livraison de NovaTech HRFlow.

L’énoncé officiel est disponible dans docs/ENONCE-BC03.md.

Le dépôt comprend six composants :

- frontend
- api-gateway
- auth
- paie
- conges
- recrutement

La responsabilité actuelle concerne le livrable J3 :

- Infrastructure as Code ;
- AWS ECR ;
- AWS ECS Fargate ;
- Application Load Balancer ;
- staging et production séparés ;
- health checks et smoke tests ;
- déploiement Blue/Green ou zero-downtime ;
- feature flag ;
- rollback inférieur à dix minutes ;
- documentation et preuves de démonstration.

## Méthode obligatoire

1. Lire les fichiers concernés avant toute modification.
2. Proposer un plan avant une modification importante.
3. Effectuer une seule étape à la fois.
4. Ne modifier que les fichiers explicitement autorisés.
5. Présenter le diff après chaque modification.
6. Exécuter les validations locales disponibles.
7. Signaler les informations non confirmées.
8. Ne jamais prétendre qu’un test ou un déploiement a réussi sans preuve.

## Git

- Ne jamais travailler directement sur main.
- Ne jamais exécuter git push sans autorisation.
- Ne jamais créer ou fusionner une pull request sans autorisation.
- Ne jamais utiliser git add .
- Ne jamais écraser une modification préexistante.
- Ne jamais modifier scripts/deploy.sh sans autorisation explicite.
- Préserver les travaux J1 et J2.
- Utiliser des commits petits et ciblés.

## Sécurité

- Ne jamais lire ou afficher les valeurs du fichier .env.
- Ne jamais copier .env dans une image Docker.
- Ne jamais ajouter un secret dans Git, Docker, Terraform ou la documentation.
- Utiliser uniquement les noms des variables d’environnement.
- Prévoir GitHub OIDC et AWS Secrets Manager.
- Ne jamais afficher un token ou un mot de passe dans les logs.
- Signaler immédiatement toute donnée sensible détectée.

## Docker

- Utiliser les chemins et ports définis dans
  docs/j3-component-contract.md.
- Ne pas inventer de scripts npm.
- Ne pas utiliser de dossier dist lorsque l’application n’est pas transpilée.
- Utiliser des images taguées avec le SHA Git.
- Ne pas utiliser latest pour un déploiement.
- Valider chaque image avec un build réel.

## Terraform et AWS

Les commandes suivantes nécessitent toujours une autorisation humaine :

- terraform plan connecté au compte AWS ;
- terraform apply ;
- terraform destroy ;
- aws ecs update-service ;
- push vers Amazon ECR ;
- création, modification ou suppression de ressources AWS ;
- déploiement staging ;
- déploiement production ;
- déclenchement d’un rollback.

Les commandes locales suivantes sont autorisées :

- terraform fmt ;
- terraform init -backend=false ;
- terraform validate ;
- vérification de syntaxe ;
- génération de documentation.

## Documentation

- Documenter les décisions pendant l’implémentation.
- Distinguer ce qui est prévu, créé, testé et démontré.
- Ne jamais inventer de capture, métrique, durée ou résultat.
- Conserver les preuves sans secret.
- Mettre à jour la documentation après chaque étape importante.

## Limites de coût

- Budget AWS maximal : 50 euros.
- Aucun NAT Gateway sans autorisation.
- Aucun ElastiCache si Redis n’est pas réellement utilisé.
- Utiliser un seul ALB lorsque cela est possible.
- Prévoir une rétention courte des logs.
- Signaler toute ressource payante avant sa création.
