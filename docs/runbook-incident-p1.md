# Runbook — Incident P1 (indisponibilité de service)

> Livrable **L4** · procédure pas-à-pas pour un incident critique HRFlow.
> Objectif : de la détection au rétablissement en **moins de 10 minutes**,
> sans décision improvisée.

## 1. Qu'est-ce qu'un P1 ?

Un **P1** = un service métier indisponible ou dégradé au point d'empêcher un
usage critique (connexion, paie, congés, recrutement) en **production**.

Déclencheurs typiques :
- alerte Slack **`ServiceDown`** (un service ne répond plus au scrape) ;
- alerte **`HighErrorRate`** (> 5 % de 5xx) ou **`HighLatencyP99`** (> 1 s) ;
- signalement utilisateur d'une fonctionnalité inaccessible.

> **Référence historique.** L'incident P1 de la nuit du 14-15 août 2024 a été
> causé par une erreur asynchrone non gérée qui a **arrêté le processus** d'un
> service (mécanisme documenté au L2 sous **BUG-01**). Personne n'a été alerté
> avant l'appel client à 2 h 15. Ce runbook + l'alerte `ServiceDown` existent
> pour que ça ne se reproduise pas : l'alerte part désormais en < 2 min.

## 2. Rôles pendant l'incident

| Rôle | Responsabilité |
|---|---|
| **Pilote incident** | prend la main, déroule ce runbook, décide du rollback |
| **Support technique** | diagnostique (logs, métriques), exécute les commandes |
| **Communication** | tient le canal `#hrflow-alertes` à jour (début, décision, fin) |

À 3 personnes, une seule peut cumuler pilote + technique ; garder la comm
séparée.

## 3. Détection (0–1 min)

1. L'alerte tombe sur **`#hrflow-alertes`** (Alertmanager → Slack).
2. Ouvrir **Grafana → dashboard « HRFlow — 4 Golden Signals »**, sélectionner
   l'environnement `production`.
3. Identifier le **service** et le **signal** touchés :
   - panneau *Disponibilité* rouge → service **mort** (cas BUG-01) ;
   - *Erreurs* qui grimpe → 5xx, souvent base de données ;
   - *Latence P99* qui grimpe → saturation ou dépendance lente ;
   - *Saturation* (event loop / mémoire) → surcharge.

## 4. Diagnostic (1–3 min)

| Symptôme | Vérification | Cause probable |
|---|---|---|
| `up == 0` sur un service | `curl http://<service>.production.novatech.local:<port>/health` → pas de réponse | **processus arrêté** (BUG-01) |
| 5xx en hausse | logs du service (CloudWatch / `docker logs`) : `connection terminated`, erreurs pg | base injoignable / requête cassée |
| P99 en hausse, `up == 1` | panneau Saturation : event loop lag, RSS | surcharge, fuite mémoire |
| Un seul environnement touché | comparer staging vs production | régression du dernier déploiement |

**Règle d'or** : ne pas corriger le code en pleine nuit. On **rétablit d'abord**
(rollback), on diagnostique la cause à froid ensuite.

## 5. Décision (3–4 min)

```
Le dernier déploiement est-il récent (< 30 min) ?
├─ OUI → ROLLBACK Blue/Green (§6). C'est le cas le plus fréquent et le plus rapide.
└─ NON
   ├─ Fonctionnalité isolée en cause ? → couper via FEATURE FLAG (§7), pas de rollback.
   └─ Service mort sans déploiement récent ? → REDÉMARRER le service (§8),
      puis surveiller la récidive (BUG-01 : le process peut re-mourir).
```

## 6. Rollback Blue/Green (< 10 min) — voir infra L3

Le déploiement prod est Blue/Green : deux versions coexistent derrière l'ALB,
on rebascule le trafic sur la version saine.

1. Identifier la version stable précédente (tag d'image / task definition).
2. Rebasculer les **target groups** de l'ALB vers l'ancienne version
   (procédure et script dans `infra/terraform` — livrable L3).
3. **Chronométrer** : l'objectif est < 10 min, du déclenchement au trafic
   rétabli.
4. Vérifier dans Grafana que `up` repasse à 1 et que les erreurs retombent.
5. Annoncer le rétablissement sur `#hrflow-alertes`.

## 7. Couper par feature flag (alternative sans rollback)

Si la panne vient d'une fonctionnalité identifiée (ex. recrutement) :
- passer `FEATURE_RECRUITMENT_ENABLED=false` sur la passerelle et redéployer la
  config → la route est coupée proprement, le reste de l'appli reste debout.

## 8. Redémarrer un service mort

Rétablissement immédiat mais **temporaire** si la cause est BUG-01 (le process
peut re-planter à la prochaine requête déclenchante) :
- ECS relance la tâche défaillante automatiquement (health check ALB) ;
- forcer si besoin : redéploiement de la task definition inchangée.
- **surveiller la récidive** dans les 15 min ; si ça re-tombe, passer au rollback.

## 9. Clôture et post-mortem (à froid, < 48 h)

Un incident P1 se clôt par un **post-mortem sans blâme** :

| Section | Contenu |
|---|---|
| **Résumé** | ce qui s'est passé, en 3 lignes |
| **Chronologie** | détection → décision → rétablissement, avec les heures |
| **Impact** | services touchés, durée, utilisateurs affectés |
| **Cause racine** | le *pourquoi* technique, pas le *qui* |
| **Ce qui a bien marché** | l'alerte a-t-elle été rapide ? le rollback tenu en 10 min ? |
| **Actions correctives** | tâches concrètes, avec un responsable et une échéance |

### Exemple appliqué — post-mortem de l'incident d'août 2024

- **Cause racine** : `emp.rows[0]` non vérifié sur `/paie/heures-sup` ; sur un
  employé inexistant, la `TypeError` remonte dans un handler `async` non
  enveloppé, et Node arrête le processus (BUG-01). Route publique → une requête
  suffisait.
- **Pourquoi personne n'a été alerté** : aucun monitoring, aucune alerte.
- **Actions correctives** (état au L4) :
  - [x] alerte `ServiceDown` en place (notifie en < 2 min) ;
  - [x] défaut couvert par un test de non-régression (`tests/e2e/06-deni-de-service.spec.js`) ;
  - [ ] corriger BUG-01 (garde sur `rows.length` + wrapper async) — plan de remédiation.

## 10. Aide-mémoire

| Ressource | Où |
|---|---|
| Alertes | `#hrflow-alertes` (Slack) |
| Dashboards | Grafana → « HRFlow — 4 Golden Signals » |
| Alertes actives | Alertmanager (`:9093`) |
| Rollback | `infra/terraform` (L3) |
| Défauts connus | `docs/regressions-detectees.md` |
