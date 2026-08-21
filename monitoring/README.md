# Monitoring HRFlow — Prometheus · Grafana · Alertmanager (L4)

Observabilité des 5 services, à partir de l'endpoint `/metrics` exposé par
chacun (instrumentation prom-client, PR #7).

## Ce que ça couvre — les 4 golden signals

| Signal | Métrique | Où le voir |
|---|---|---|
| **Latence** | `http_request_duration_seconds` (histogramme, P99) | dashboard Grafana, panneau Latence |
| **Trafic** | `http_requests_total` (taux) | panneau Trafic |
| **Erreurs** | `http_requests_total{status_code=~"5.."}` | panneau Erreurs |
| **Saturation** | `nodejs_eventloop_lag_seconds`, `process_resident_memory_bytes` | panneau Saturation |

## Arborescence

```
monitoring/
├── prometheus/
│   ├── prometheus.yml         ← config VPC : scrape les DNS Cloud Map internes
│   ├── prometheus.local.yml   ← config démo : scrape les services en local
│   └── rules/alerts.yml       ← alertes (golden signals + service mort)
├── alertmanager/
│   ├── alertmanager.yml       ← routage vers Slack
│   └── slack_webhook_url.example
├── grafana/                   ← datasource + dashboard provisionnés
└── docker-compose.monitoring.yml
```

## Cibles de scrape (fournies par l'infra L3)

Noms DNS internes Cloud Map, résolvables uniquement **dans le VPC** :

| Service | Port | staging | production |
|---|---|---|---|
| auth | 3001 | `auth.staging.novatech.local` | `auth.production.novatech.local` |
| paie | 3002 | `paie.staging.novatech.local` | `paie.production.novatech.local` |
| conges | 3003 | `conges.staging.novatech.local` | `conges.production.novatech.local` |
| recrutement | 3004 | `recrutement.staging.novatech.local` | `recrutement.production.novatech.local` |

### API Gateway — non scrapée (angle mort assumé)

La passerelle (port 3000) n'est pas scrapée : **l'association à Cloud Map n'est
pas supportée sous ECS Blue/Green** (confirmé par l'infra). Les 4 services
métier — qui portent la logique et les incidents — sont couverts ; scraper la
passerelle via l'ALB public exposerait `/metrics`, ce qu'on refuse.

## Démo locale (pour la soutenance)

Prometheus dans le VPC scrape les DNS Cloud Map ; en local, on utilise
`prometheus.local.yml` qui scrape les services lancés sur la machine.

```bash
# 1. lancer les 5 services (chacun dans un terminal, ou via un script)
node services/auth/src/server.js        # :3001
node services/paie/src/server.js        # :3002
node services/conges/src/server.js      # :3003
node services/recrutement/src/server.js # :3004
node services/api-gateway/src/server.js # :3000

# 2. configurer le webhook Slack
cp monitoring/alertmanager/slack_webhook_url.example monitoring/alertmanager/slack_webhook_url
#   puis coller l'URL réelle du webhook dans ce fichier

# 3. démarrer la stack
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```

- Prometheus : http://localhost:9090 (onglet *Status → Targets* : les 5 services en `UP`)
- Grafana : http://localhost:3080 (`admin` / `admin`) → dashboard **HRFlow — 4 Golden Signals**
- Alertmanager : http://localhost:9093

## Simulation d'incident (preuve d'alerting demandée par le sujet)

L'alerte `ServiceDown` est la traduction directe de **BUG-01** (déni de service
silencieux trouvé au L2) : un processus qui meurt ne répond plus au scrape.

**Scénario à filmer :**

1. Tout est vert dans Grafana, les 5 services `UP` dans Prometheus.
2. Tuer le service paie — soit `Ctrl-C` sur son terminal, soit déclencher
   BUG-01 en une requête : `curl -X POST localhost:3002/paie/heures-sup -H 'Content-Type: application/json' -d '{"employeeId":999999,"heures":8}'`
   (le processus sort en erreur, cf. `tests/e2e/06-deni-de-service.spec.js`).
3. Dans Prometheus, `up{service="paie"}` passe à 0.
4. Après ~1 min, l'alerte `ServiceDown` passe *firing* (http://localhost:9093).
5. **Le message part sur `#hrflow-alertes`** — c'est la preuve attendue (< 2 min).

Ce scénario relie directement la partie Tests (BUG-01) au monitoring : le défaut
qu'on a trouvé et documenté au L2 est désormais détecté et notifié en < 2 min.

## Secret

Le fichier `alertmanager/slack_webhook_url` (URL réelle) est **git-ignoré**.
En production, l'URL vient d'un secret ECS / Secrets Manager, jamais du dépôt.
