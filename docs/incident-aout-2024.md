# Post-mortem Incident P1 — 14/15 août 2024

**Rédigé par** : Karim Bouaziz (CEO)
**Date de rédaction** : 16 août 2024
**Durée de l'incident** : 3h07 (23h47 → 02h54)

## Résumé
Coupure totale de HRFlow pendant 3h07. Cause : migration BDD déclenchée manuellement en prod à 23h30.

## Chronologie
- **23h30** : Théo lance une migration SQL en prod via `/paie/migrate`
- **23h47** : La migration corrompt la table `employees`. Plateforme HS.
- **23h47** : Aucune alerte automatique. Personne n'est notifié.
- **02h15** : Client hôtelier appelle le numéro d'urgence.
- **02h22** : Karim réveille Théo.
- **02h25** : Théo tente un rollback. Pas de procédure documentée.
- **02h54** : Restauration backup 22h30. Perte de 1h17 de données.

## Impact
- 8 200 utilisateurs impactés
- 3 clients résiliés en 2 semaines
- 2 mises en demeure reçues
- Départ du CTO le 26 août

## Causes racines
1. Route /paie/migrate sans authentification
2. Aucun test avant exécution en production
3. Pas de backup récent
4. Aucun monitoring / alerting
5. Procédure de rollback inexistante

## Actions décidées
- [ ] Sécuriser /paie/migrate
- [ ] Backups automatiques toutes les heures
- [ ] Procédure de rollback documentée
- [ ] Monitoring
- [ ] Ne plus déployer en prod après 18h

**Status** : aucune action réalisée (26/08/2024) — le CTO est parti avant d'agir.
