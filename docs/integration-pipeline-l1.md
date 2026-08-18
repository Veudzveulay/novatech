# Intégration des stages L2 dans le pipeline du L1

> Établi le 23/07/2026, après réception du livrable L1.
> Destinataire : la personne en charge du L1 (pipeline `.github/workflows/ci.yml`).

---

## 0. Décisions prises le 23/07 — à appliquer côté L1

| # | Sujet | Décision | Ce que ça implique pour le L1 |
|---|---|---|---|
| D1 | Service `auth` | **6ᵉ unité déployable**, pas de fusion dans `api-gateway` | ajouter `docker/auth/Dockerfile` + 1 ligne dans les 2 matrices |
| D2 | Nomenclature | **noms réels des dossiers**, sans préfixe `service-` | renommer les entrées de matrice et les dossiers `docker/` |
| D3 | Gestion des dépendances | **workspaces npm conservés**, un seul `package-lock.json` à la racine | adapter `cache-dependency-path` et les Dockerfiles |
| D4 | Stage Security rouge | **assumé jusqu'au J3**, aucune exception ajoutée | ne pas mettre le Stage 3 en statut requis avant que la remédiation soit passée |

Justifications détaillées dans
[`docs/blocages-inter-livrables.md`](blocages-inter-livrables.md) § Décisions.

### Matrice à utiliser dans `ci.yml` (D1 + D2)

```yaml
    strategy:
      fail-fast: false
      matrix:
        unite: [front, api-gateway, auth, paie, conges, recrutement]
```

Et les chemins associés :

| Ancien | Nouveau |
|---|---|
| `services/${{ matrix.service }}` | `services/${{ matrix.unite }}` (et `frontend/` pour `front`) |
| `docker/service-paie/Dockerfile` | `docker/paie/Dockerfile` |
| — | `docker/auth/Dockerfile` **à créer** |

### Cache npm (D3)

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          # Un seul lockfile à la racine : ne PAS pointer vers
          # services/<unité>/package-lock.json, ils n'existent pas.
          cache-dependency-path: package-lock.json
```

Le L1 livre le **Stage 1** (Lint / Type-check / Docker build) avec la note :

> « les stages Test (Jest/Playwright/coverage), Security (Trivy/ZAP), Staging et
> Production seront ajoutés dans ce même fichier au fil des livrables J2/J3 »

Le L2 livre les **Stages 2 et 3**. Ils sont écrits comme workflows réutilisables
(`on: workflow_call`) : rien à recopier, seulement à appeler.

---

## 1. Le patch à appliquer dans `.github/workflows/ci.yml`

À insérer **entre** le job `docker-build` et le job `stage-1-status` :

```yaml
  # ---------------------------------------------------------------------------
  # Stage 2 — Tests (livrable L2)
  # ---------------------------------------------------------------------------
  stage-2-tests:
    name: Stage 2 — Tests
    needs: lint-and-typecheck
    uses: ./.github/workflows/test.yml
    permissions:
      contents: read
      pull-requests: write   # OBLIGATOIRE : commentaire de couverture sur la PR

  # ---------------------------------------------------------------------------
  # Stage 3 — Sécurité (livrable L2)
  # ---------------------------------------------------------------------------
  stage-3-security:
    name: Stage 3 — Sécurité
    needs: stage-2-tests
    uses: ./.github/workflows/security.yml
    permissions:
      contents: read
      security-events: write
```

Puis modifier le job récapitulatif :

```yaml
  stage-1-status:
    name: Pipeline — Build, Test & Security OK
    needs: [lint-and-typecheck, docker-build, stage-2-tests, stage-3-security]
```

### Deux points d'attention

**Les permissions ne s'héritent pas automatiquement.** Sans
`pull-requests: write` sur `stage-2-tests`, le commentaire de couverture échoue
en silence — le job reste vert et personne ne voit la couverture sur la PR.

**Renommer le statut requis dans la protection de branche.** Le README du L1
demande de configurer `Stage 1 — Build OK` comme statut obligatoire. Si le job
est renommé comme ci-dessus, il faut mettre à jour la règle GitHub, sinon la
protection pointe vers un statut qui n'existe plus et **n'importe quelle PR
devient mergeable**.

---

## 2. Ce qui est déjà aligné

| Sujet | L1 | L2 | Statut |
|---|---|---|---|
| Version de Node | 20 | 20 | ✅ aligné |
| Déclenchement | PR vers `main` + push `main` | idem (aligné sur Trunk-Based le 23/07) | ✅ |
| Seuil de couverture | ≥ 80 % (gate Stage 2) | 80 % statements/lines, 75 % branches, bloquant | ✅ |
| Gate sécurité | 0 CRITICAL Trivy, 0 High ZAP | CRITICAL+HIGH bloquants, ZAP sans `-I` | ✅ |
| Outil de scan deps | « Snyk / Dependabot » dans le schéma | `npm audit` + Dependabot | ⚠️ Snyk à retirer du schéma (payant, écarté par l'équipe) |

---

## 3. Ce qui bloque encore

### 3.1 Le service `auth` n'existe nulle part dans le L1 · **bloquant**

`docs/01-architecture-pipeline.md` § 2 décrit 5 unités déployables et attribue
l'authentification à `api-gateway` (« Point d'entrée API, auth, routage »).

Dans le dépôt, ce n'est pas le cas : `services/auth/` est un **service à part
entière**, avec son `package.json`, son pool PostgreSQL et son écoute sur le
port 3001. La passerelle ne fait que lui proxifier `/api/auth`.

Conséquence : pas de Dockerfile, pas de ligne dans la matrice CI, pas d'image,
donc **pas de scan Trivy** — sur le service qui porte l'injection SQL (VULN-01)
et le secret JWT codé en dur (VULN-02). C'est-à-dire les deux vulnérabilités les
plus graves de l'application.

**Demande** : ajouter `auth` comme 6ᵉ unité (Dockerfile + matrice). La ligne est
déjà prête et commentée dans la matrice de `security.yml`.

### 3.2 Les Dockerfiles ne construisent pas contre ce dépôt

`docker build --target prod ./docker/api-gateway` échoue aujourd'hui. Quatre
causes, par ordre d'apparition :

| # | Problème | Détail |
|---|---|---|
| 1 | Contexte de build vide | `context: ./docker/<unité>` ne contient que le Dockerfile. `COPY package.json package-lock.json ./` échoue à la 4ᵉ instruction |
| 2 | Scripts npm inexistants | `npm run lint`, `npm run typecheck`, `npm run build` : aucun n'existe dans les 5 `package.json`. Pas d'ESLint, pas de TypeScript, pas de bundler |
| 3 | Artefact `dist/` inexistant | `CMD ["node", "dist/index.js"]` — le code est du JS simple dans `src/`. Depuis le L2, le point d'entrée est `src/server.js` |
| 4 | `package-lock.json` par service | Le L2 a introduit des **workspaces npm** : il y a un seul lock à la racine. À trancher (voir 3.3) |

Le README du L1 propose de « placer le `package.json` de chaque service à côté
du Dockerfile ». Cela ne suffit pas : même avec le `package.json`, `COPY . .`
ne copierait toujours pas `src/`, qui est en dehors du contexte.

**Correction suggérée** : contexte à la racine du dépôt, Dockerfile référencé
par son chemin.

```yaml
      - uses: docker/build-push-action@v6
        with:
          context: .                                        # racine du dépôt
          file: ./docker/${{ matrix.unite }}/Dockerfile
          target: prod
```

et dans le Dockerfile :

```dockerfile
FROM node:${NODE_VERSION} AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/paie/package.json ./services/paie/

FROM base AS deps
RUN npm ci --workspace=@hrflow/paie --include-workspace-root

FROM deps AS prod
COPY services/paie/src ./services/paie/src
USER novatech
EXPOSE 3002
CMD ["node", "services/paie/src/server.js"]
```

### 3.3 Nomenclature et arborescence · **tranché (D2)**

| Le L1 attend | Le dépôt contient |
|---|---|
| `services/front/` | `frontend/` |
| `services/service-paie/` | `services/paie/` |
| `services/service-conges/` | `services/conges/` |
| `services/service-recrutement/` | `services/recrutement/` |
| `services/api-gateway/` | `services/api-gateway/` ✅ |
| — | `services/auth/` (absent du L1) |

En l'état, `working-directory: services/${{ matrix.service }}` pointe vers
`services/service-paie`, qui n'existe pas : **les 5 jobs `lint-and-typecheck`
échouent au premier `npm ci`**.

**Décision retenue : renommer la matrice**, pas les dossiers du dépôt.

Renommer les dossiers casserait tous les chemins des 162 tests du L2, les
`require()` des services, et brouillerait l'historique Git — que le jury va
lire. Le préfixe `service-` est de toute façon redondant sous `services/`.

Le renommage porte donc sur les entrées de matrice et sur les dossiers
`docker/`, qui ne sont référencés nulle part ailleurs.

### 3.4 Ports et sondes de santé

`EXPOSE 3000` et `HEALTHCHECK ... http://localhost:3000/health` sont identiques
dans les 5 Dockerfiles. Or :

| Service | Port réel | `/health` |
|---|---|---|
| api-gateway | 3000 | ✅ oui |
| auth | 3001 | ❌ non |
| paie | 3002 | ❌ non |
| conges | 3003 | ❌ non |
| recrutement | 3004 | ❌ non |

Les 4 services métier démarreraient en `unhealthy` permanent. Il faut soit un
port et une sonde par service, soit ajouter `/health` aux 4 services.

**À rapprocher de BUG-10** (`docs/regressions-detectees.md`) : même le `/health`
de la passerelle ne vérifie rien — ni base, ni services amont. Une sonde qui ne
peut pas échouer rendra le Blue/Green du L3 aveugle.

### 3.5 Le stage `test` du Dockerfile fait doublon

Chaque Dockerfile porte une cible `test` exécutant `npm run test -- --coverage`.
Le Stage 2 du L2 lance déjà les tests directement sur le runner, avec un service
container PostgreSQL.

Faire tourner les tests dans l'image imposerait d'y joindre une base : plus lent,
plus fragile, aucun gain. **Suggestion** : garder la cible `test` pour l'usage
local du développeur, ne pas la câbler dans la CI.

---

## 4. Ce que le L2 a déjà ajusté de son côté

- déclenchement aligné sur Trunk-Based : PR vers `main` uniquement, `dev` retiré ;
- matrice `trivy-images` renommée sur la nomenclature du L1, avec la ligne `auth`
  documentée comme manquante ;
- version de Node confirmée à 20 des deux côtés (le blocage B-07 est levé) ;
- mention de Snyk signalée comme à retirer du schéma.
