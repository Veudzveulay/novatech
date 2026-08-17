# Stratégie de branchement — NovaTech / HRFlow

**Livrable J1 — BC03 · Projet ShipIt**

## 1. Choix retenu : Trunk-Based Development

Après analyse du contexte NovaTech, nous retenons une stratégie **Trunk-Based Development (TBD)**
avec branches courtes et feature flags, plutôt que Git Flow.

## 2. Options écartées et pourquoi

### Git Flow — écarté

Git Flow (branches `develop`, `release/*`, `hotfix/*`, `feature/*` longue durée) est pensé pour des
logiciels versionnés avec des cycles de release espacés (ex. logiciel packagé, plusieurs versions
supportées en parallèle). Ce n'est pas le cas de NovaTech :

- HRFlow est un **SaaS mono-version**, servi en continu à 8 200 utilisateurs — il n'y a qu'une seule
  version "vivante" en production à tout instant.
- Le repo actuel a déjà une branche `feature/recrutement-v2` ouverte depuis **4 mois** : c'est le symptôme
  exact que Git Flow produit avec une petite équipe — des branches longues qui divergent, difficiles à
  merger, et qui retardent la livraison. Avec 4 devs, ce coût est disproportionné.
- Git Flow ajoute une couche de process (branches `release`) qui n'apporte rien ici : il n'y a pas de
  notion de "version packagée à figer" à livrer plus tard.

### GitHub Flow (seul) — insuffisant tel quel

Plus proche de notre besoin, mais nous le complétons car GitHub Flow suppose que tout ce qui est mergé
sur `main` est immédiatement livrable en l'état. Sur un produit RH avec paie légale et SLA à 99,5 %,
nous ne voulons pas dépendre uniquement de la discipline des PR pour ça — d'où l'ajout des feature flags
(cf. §4).

## 3. Fonctionnement retenu

- **`main` est la seule branche longue vivante.** Elle est protégée : pas de push direct (c'est
  exactement ce qui a causé l'incident P2 d'avril — un push direct de Rayan sur `main` en pleine clôture
  de paie).
- Chaque développement se fait sur une **branche courte** (`feat/xxx`, `fix/xxx`), **durée de vie cible
  < 2 jours**, créée depuis `main` et mergée dans `main` via Pull Request.
- **Règles de protection de branche `main`** :
  - 1 review obligatoire avant merge (répond au problème "Théo est le seul à connaître tout le code" —
    ça force le partage de connaissance).
  - Statut CI vert obligatoire (build + lint + type-check + tests + scan sécurité) avant merge — le
    pipeline décrit dans `01-architecture-pipeline.md` fait office de gate automatique.
  - Pas de merge direct possible même pour le Lead Dev.
- **Feature flags (Unleash)** pour toute fonctionnalité incomplète ou risquée mergée sur `main` : le code
  est intégré en continu, mais son activation en production est pilotée indépendamment du déploiement.
  Cela permet en particulier à Rayan de ne plus bloquer ses PR par peur de casser la prod : le code peut
  être mergé et déployé "éteint", puis activé progressivement.
- **Hotfix** : en cas d'incident (type P1 août 2024), un correctif part directement d'une branche courte
  depuis `main`, passe par le pipeline complet (aucune exception, même en urgence — c'est justement
  l'absence de ce garde-fou qui a aggravé l'incident d'août), et est déployé via rollback/redeploy accéléré.

## 4. Cohérence avec le pipeline et les contraintes NovaTech

| Contrainte NovaTech | Réponse apportée par TBD + feature flags |
|---|---|
| SLA 99,5 %, une seule prod à date | Pas de gestion multi-versions inutile (vs Git Flow) |
| 4 branches mortes + `feature/recrutement-v2` ouverte 4 mois | Branches courtes obligatoires, suppression auto après merge |
| Push direct sur `main` à l'origine d'un P2 | `main` protégée, CI obligatoire, revue obligatoire |
| Rayan bloque des features par peur de casser la prod | Feature flags : déployer ≠ activer |
| Théo seul détenteur de la connaissance du code | Review obligatoire sur chaque PR |
| Déploiement continu attendu (5 stages sans étape manuelle) | TBD est la stratégie de référence pour du CD réel |

## 5. Limites assumées

- Nécessite une discipline d'équipe sur la taille des PR (petites, fréquentes) — à cadrer dès J1 avec
  Camille et Rayan.
- Nécessite un vrai outillage de feature flags opérationnel dès J3 (cf. livrable J3) pour tenir la promesse
  "déployer sans activer".
