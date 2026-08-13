# Runbook de démonstration rollback ECS Blue/Green — J3

## Statut et sécurité

Cette procédure prépare une démonstration future. Elle n'a pas été exécutée sur
AWS et ne prouve pas encore un rollback inférieur à dix minutes. Les commandes
contiennent uniquement des placeholders et ne doivent être exécutées qu'après
autorisation humaine, revue du plan Terraform et vérification du budget.

Le header `X-NovaTech-Preview` n'est pas une authentification. Les appels de
preview doivent rester limités à `/health` et à des smoke tests sans donnée
métier sensible.

## Prérequis

- infrastructure Terraform revue puis créée lors d'une étape AWS autorisée ;
- déploiement Blue sain et marqué terminé par ECS ;
- image saine identifiée par un tag SHA immuable ;
- image de démonstration dédiée, sans secret, retournant volontairement HTTP
  500 sur `/health`, construite et publiée lors d'une étape séparée autorisée ;
- ARN du cluster, du service et du déploiement relevés depuis les outputs ou la
  console AWS ;
- horloge de référence et journal de preuve prêts.

L'image de démonstration est le scénario retenu : elle est explicite, isolée,
réversible en revenant au SHA sain et ne nécessite aucune modification durable
du code métier ou des secrets. Elle ne doit jamais être promue comme image
fonctionnelle.

## Procédure future

1. Vérifier que Blue est sain, que la règle de production lui attribue le
   trafic et que les alarmes sont en état `OK` ou `INSUFFICIENT_DATA`.
2. Noter l'heure de début `T0`, le SHA sain et l'identifiant du service.
3. Enregistrer une task definition Green pointant vers l'image de démonstration,
   puis lancer sa révision avec le processus de déploiement autorisé.
4. Pendant la phase de test, appeler uniquement les endpoints suivants :

   ```bash
   curl -i -H "X-NovaTech-Preview: frontend" http://<alb-dns>/health
   curl -i -X OPTIONS -H "X-NovaTech-Preview: api-gateway" \
     http://<alb-dns>/api/recrutement/candidats
   ```

   La seconde requête est un smoke test `OPTIONS` sans lecture ni mutation de
   donnée ; la règle API impose le préfixe `/api/*`, tandis que le health check
   ALB interne continue d'utiliser `/health` directement sur le target group.
5. Observer que Green retourne HTTP 500 sur son health check, devient unhealthy
   et reste distinct de Blue. Ne lancer aucun appel métier.
6. Observer l'alarme `UnHealthyHostCount` du target group physique recevant la
   nouvelle révision, puis noter l'heure du passage en `ALARM`. Les rôles
   primaire et alternatif peuvent s'inverser entre deux déploiements ; les deux
   target groups du composant sont donc surveillés.
7. Observer dans l'historique ECS les états d'échec et de rollback. Les futures
   commandes de lecture pourront suivre cette forme :

   ```bash
   aws ecs describe-services --cluster <cluster> --services <service>
   aws ecs list-service-deployments --cluster <cluster> --service <service>
   aws cloudwatch describe-alarms --alarm-names <alarm-name>
   aws elbv2 describe-rules --rule-arns <production-rule-arn> <test-rule-arn>
   ```

8. Vérifier que le déploiement Green est abandonné et que Blue reste ou redevient
   la révision active avec `/health` en HTTP 200.
9. Noter l'heure finale `T1` et calculer `T1 - T0`.

Ces commandes ne sont pas exécutées dans cette étape et nécessitent une
autorisation AWS explicite.

## Critère de succès

La démonstration réussit uniquement si :

- Green échoue sans interrompre Blue ;
- ECS détecte l'échec et réalise le rollback ;
- les règles ALB reviennent à l'état attendu ;
- les endpoints normaux répondent de nouveau HTTP 200 ;
- la durée mesurée entre `T0` et `T1` est strictement inférieure à dix minutes.

## Preuves à conserver pour le jury

- SHA et digest des images saine et défaillante ;
- heure `T0`, heure de l'alarme et heure `T1` ;
- états successifs du déploiement ECS et motif du rollback ;
- graphique CloudWatch de l'alarme déclenchée ;
- poids des target groups avant, pendant et après le rollback ;
- réponses `/health` Blue et Green, sans header d'autorisation ni secret ;
- résultat final et durée calculée, même si l'objectif échoue.
