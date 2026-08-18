# Énoncé officiel — Projet BC03 ShipIt

> Source : portail pédagogique de l’école.
> Copie de travail conservée dans le dépôt pour guider l’implémentation.

RNCP 38822
|
BC03 — Piloter la mise en production & l'évolution des solutions logicielles
M2 LEAD DEV FULL STACK · Niveau 7
Projet évaluatif BC03 · Workshop Expert
Ship/It
$ git push origin main → production
Une scale-up parisienne vient de vous recruter comme Lead DevOps. Leur pipeline de livraison est cassé, leurs tests sont inexistants et leur dernière mise en prod a déclenché un incident P1 à 3h du matin. Vous avez 5 jours pour tout réparer — et documenter chaque geste.

5 jours
Équipes de 3 à 4
100 pts + 15 bonus
Soutenance + démo live
BC03 — DevOps / CI-CD / Tests
shipit-pipeline · gitlab-ci.yml
# ShipIt Pipeline — NovaTech SAS
────────────────────────────────
▶ Stage 1 — Build
✓ docker build -t novatech:sha-4f2a1c
✓ push registry.gitlab.com/novatech
▶ Stage 2 — Test
✓ jest --coverage (89% lines)
✓ playwright e2e (12/12 passed)
⚠ eslint 3 warnings (non bloquant)
▶ Stage 3 — Security
✓ trivy scan: 0 CRITICAL
✓ OWASP ZAP: no high severity
▶ Stage 4 — Deploy
✓ staging → OK (health check 200)
⏳ production deploying... █
────────────────────────────────
Duration: 4m 23s Runner: docker
Référentiel RNCP 38822 — BC03
Ce que ce bloc évalue
Titre du bloc
Piloter la mise en production des solutions logicielles et leur évolution — intégration continue, tests automatisés, déploiement continu, documentation

Niveau & Certificateur
Expert en Architecture & Développement Logiciel · Niveau 7 (Bac+5) · Certifié INGETIS · Valide 5 ans (2024)

Public visé
M2 Lead Dev Full Stack — compétences avancées en CI/CD, DevOps, qualité logicielle, monitoring et documentation technique

Compétences activées
Les 6 compétences BC03 couvertes
⚙️
Intégration continue (CI)
Piloter le système d'intégration continue dans un environnement Agile/DevOps — GitHub Actions ou GitLab CI, contrôle de versions, automatisation des builds

🧪
Tests automatisés
Organiser le plan de tests itératifs — unitaires, intégration, E2E, sécurité — en parallèle du développement, dans un pipeline DevOps

📡
Surveillance des mises à jour
Monitorer les automatisations de livraison en conditions proches de la prod, avec retour d'information continu sur les performances et la stabilité

🚀
Déploiement continu (CD)
Piloter le déploiement continu automatisé sur toutes les plateformes cibles, mise à disposition sans intervention manuelle, avec rollback possible

🔁
Opérations DevOps (Ops)
Piloter l'optimisation via alertes, notifications d'anomalies, environnement unifié, chaîne d'outils intégrée pour amélioration continue

📄
Documentation technique
Organiser la rédaction de la documentation (manuel, User stories, structure BDD, schéma sécurité), en français et en anglais, accessible à tous publics

Mise en situation professionnelle
Le brief NovaTech
🏢
NovaTech SAS — Plateforme RH SaaS B2B
Paris 11e · Fondée en 2019 · 45 collaborateurs · 8 200 utilisateurs actifs · Série A (4,5 M€) clôturée en mars 2024

Portrait de l'entreprise
NovaTech SAS édite HRFlow, une plateforme SaaS de gestion RH à destination des PME françaises (50 à 500 salariés). Le produit couvre la gestion des congés, le suivi des entretiens annuels, la gestion de la paie externalisée et un module de recrutement intégré. Fondée par deux anciens consultants RH, Karim Bouaziz (CEO) et Léa Fontaine (CPO), l'entreprise a connu une croissance rapide : de 400 à 8 200 utilisateurs en 30 mois, portée par un bouche-à-oreille fort dans les secteurs de l'hôtellerie-restauration et du commerce de détail.

La Série A de 4,5 M€ clôturée en mars 2024 avec le fonds Partech a permis de tripler les effectifs en 8 mois — passant de 15 à 45 collaborateurs. Mais cette croissance s'est faite sans jamais refondre la base technique héritée des premiers mois de startup. Résultat : une dette technique colossale, une équipe dev épuisée, et un produit qui commence à craquer sous la charge.

⚠ Chronologie des incidents — 6 derniers mois
Avril 2024
Incident P2 — Module paie indisponible 47 min
Un push direct sur main par un développeur junior a cassé le service de calcul de paie en pleine période de clôture mensuelle. 340 utilisateurs impactés. Correction à la main, SSH en prod. Aucune procédure de rollback documentée. Première plainte client formelle reçue.

Juin 2024
Fuite de données — Staging exposé sur internet
L'environnement de staging, configuré sans authentification, était accessible publiquement depuis 3 semaines. Un chercheur en sécurité externe l'a détecté et notifié NovaTech avant toute exploitation. Données de 12 entreprises clientes en staging visibles. Déclaration CNIL effectuée. Le CTO d'alors a qualifié ça de « problème de config basique ». Aucune action structurelle n'a suivi.

Août 2024
Incident P1 — 3h07 de coupure totale · Nuit du 14 au 15 août
Une migration de base de données déclenchée manuellement à 23h30 par le lead dev a corrompu la table employees en production. La plateforme est tombée à 23h47. Personne n'a été alerté automatiquement — c'est un client hôtelier qui a appelé le numéro d'urgence à 2h15. Le lead dev a été réveillé, a tenté un rollback manuel pendant 2h, a finalement restauré un backup de 22h30 (perte de 1h17 de données). Coût estimé : 3 clients résiliés, 2 mises en demeure, et le départ du CTO 10 jours plus tard.

Septembre 2024
Partech impose un audit technique — ultimatum sous 60 jours
Suite aux incidents, le fonds Partech a mandaté un cabinet externe pour auditer la dette technique. Verdict rendu le 18 septembre : « L'infrastructure actuelle ne peut pas supporter une croissance au-delà de 12 000 utilisateurs sans risque d'effondrement. La dette de tests, l'absence de CI/CD structuré et le déploiement manuel constituent un risque opérationnel majeur. » Partech a accordé 60 jours à NovaTech pour produire un plan de remédiation crédible, sous peine de gel du second versement de 1,8 M€. C'est dans ce contexte que vous êtes recrutés.

L'équipe technique actuelle
👨‍💻
Théo Marchand
Lead Dev · 3 ans chez NovaTech
Seul à connaître l'intégralité du code. Épuisé. Déploie encore en SSH. A failli démissionner après l'incident d'août.

👩‍💻
Camille Dreyfus
Dev Full Stack · 14 mois
A écrit 60% du front React. N'a jamais fait de tests automatisés. Motivée mais sans mentor technique depuis le départ du CTO.

👨‍💻
Rayan Ould
Dev Backend · 8 mois
Junior. Auteur involontaire du push qui a causé l'incident d'avril. Très prudent depuis, parfois trop — bloque la livraison de features par peur de casser la prod.

🧑‍💻
Poste vacant
CTO · Parti le 26 août 2024
Parti 10 jours après l'incident P1. Aucune passation de connaissance. A emporté dans sa tête l'architecture des 4 microservices.

« J'ai passé trois nuits blanches en août. J'ai vu trois clients nous quitter en deux semaines. J'ai eu Partech au téléphone qui me demandait si on allait "survivre techniquement". On a un produit que les gens aiment, une croissance réelle, et on est en train de tout foutre en l'air parce qu'on n'a jamais pris le temps de construire proprement. Votre mission, c'est simple : faites en sorte que la prochaine mise en prod ne me réveille pas à 3h du matin. Tout le reste, je m'en fous. »
— Karim Bouaziz, CEO & Co-fondateur · NovaTech SAS
État technique actuel — le constat
Stack : React 18 (front) · Node.js/Express (API gateway) · 3 microservices Node.js (paie, congés, recrutement) · PostgreSQL · Redis · Nginx
Repo GitHub : 1 seul repo, 3 branches actives (main, dev, feature/recrutement-v2 ouverte depuis 4 mois), des dizaines de branches mortes non supprimées
Pipeline CI : un fichier .github/workflows/deploy.yml de 12 lignes qui fait uniquement un npm install && npm build — aucun test, aucun lint, aucun gate de qualité
Déploiement : SSH manuel sur un VPS OVH 8 Go (Nginx en reverse proxy). Théo a un alias shell alias deploy="ssh prod 'cd /app && git pull && pm2 restart all'" — c'est le seul process de livraison documenté
Tests : 0% de couverture sur les 4 services back-end. 2 fichiers de tests unitaires orphelins sur le front (écrits par un stagiaire, jamais mis à jour)
Secrets : tokens AWS, clés API Stripe et secrets JWT stockés en clair dans un fichier .env commité dans le repo (découvert lors de l'audit Partech)
Documentation : un Notion avec 3 pages créées en 2021, dont une intitulée "TODO — documenter l'archi" jamais remplie. Aucun README technique, aucun schéma d'architecture
Ce que vous devez livrer
Pipeline CI/CD complet en 5 stages : Build → Test → Security → Staging → Production — aucune étape manuelle
Couverture de tests ≥ 80% sur les routes critiques des 4 services (paie, congés, recrutement, auth)
Monitoring opérationnel avec les 4 golden signals (latence, trafic, erreurs, saturation) et dashboards Grafana
Alerting automatique testé : un incident P1 doit déclencher une alerte Slack en moins de 2 minutes
Déploiement automatisé sur AWS (ECS ou EC2 + ALB) avec Blue/Green — zéro downtime démontrable
Rollback en moins de 10 minutes sur n'importe quel service — procédure documentée et testée
Suppression des secrets du repo + gestion via GitHub Secrets ou AWS Secrets Manager
Documentation technique complète : OpenAPI pour les 4 services, README onboarding, Runbook d'incident
⚠ Contrainte critique — SLA & Délai Partech
NovaTech a signé des SLA 99,5% de disponibilité mensuelle avec ses 47 clients. Partech attend un plan de remédiation crédible dans 60 jours — votre livraison constitue ce plan. Le jury jouera le rôle de Partech lors de la soutenance : il attendra des preuves concrètes, pas des intentions. Un second versement de 1,8 M€ est conditionné à la qualité de votre travail.

🔑 Accès fournis le Jour 1 matin
Vous recevrez : accès en lecture au repo GitHub NovaTech · credentials AWS sandbox (budget limité à 50€) · export anonymisé de la base de données de staging · rapport d'audit Partech (15 pages) · logs des 3 incidents (Datadog export brut) · fichier .env.example commenté par Théo Marchand la veille de votre arrivée.

💬 Point de contact
Théo Marchand (Lead Dev) sera disponible 1h par jour maximum pour répondre à vos questions sur l'architecture existante — il a un backlog produit à tenir en parallèle. Karim Bouaziz (CEO) sera présent à la soutenance finale et posera des questions en tant que décideur non-technique. Léa Fontaine (CPO) participera au Q&A pour évaluer l'impact produit de vos choix.

Architecture cible
Le pipeline à livrer
📦
Stage 1
Source & Build
GitHub / GitLab · Docker · Lint · Type-check
🧪
Stage 2
Tests
Jest · Supertest · Playwright E2E · Coverage
🔒
Stage 3
Sécurité
Trivy · OWASP ZAP · Snyk · Dependabot
🌐
Stage 4
Staging
AWS ECS · Health check · Smoke tests · Rollback auto
🚀
Stage 5
Production
Blue/Green · Feature flags · Monitoring · Alerting
Stratégie de branchement
L'équipe choisit et documente sa stratégie : Git Flow, Trunk-based ou GitHub Flow. Le choix doit être justifié au regard du contexte NovaTech (4 devs, livraisons fréquentes, SLA fort) et cohérent avec le pipeline mis en place.

Outillage
Stack technique
🐙
GitHub Actions
CI/CD principal
🐳
Docker
Containerisation
☁️
AWS (ECS/EC2)
Déploiement Cloud
🧪
Jest + Playwright
Tests auto
📊
Prometheus/Grafana
Monitoring
🔒
Trivy + ZAP
Scan sécurité
📋
Swagger/OpenAPI
Doc technique
🚩
Feature Flags
Unleash / LaunchDarkly
📣
Slack / PagerDuty
Alerting
📓
Notion / Confluence
Runbook & Wiki
Organisation du workshop
Les 5 jours en détail
1
Jour 1
Audit & Architecture
du pipeline
CI
Audit complet du repo existant : branches, historique, pipeline actuel, dépendances
CI
Définition de la stratégie Git (Git Flow vs Trunk) — décision documentée et justifiée
CI
Architecture du pipeline en 5 stages — schéma UML + choix d'outils justifiés
CODE
Mise en place des Dockerfiles multi-stage (dev / staging / prod) pour tous les services
CI
Écriture du workflow GitHub Actions : stage Build + Lint + Type-check opérationnel
Livrable J1
Schéma d'architecture du pipeline + stratégie Git + Dockerfiles + premier workflow CI qui passe

2
Jour 2
Tests automatisés
& Sécurité
TEST
Rédaction du plan de tests : unitaires, intégration, E2E — scénarios critiques identifiés
TEST
Implémentation des tests unitaires back-end (Jest + Supertest) — cible 80% coverage
TEST
Implémentation des tests E2E sur les parcours clés (Playwright) — 5 scénarios minimum
CI
Intégration du stage Test dans le pipeline + affichage du coverage report en CI
CI
Ajout du stage Sécurité : Trivy (scan images Docker) + OWASP ZAP (scan API)
Livrable J2
Suite de tests opérationnelle + rapport coverage + stage Security intégré au pipeline

3
Jour 3
Staging, CD
& Feature Flags
DEPLOY
Provisioning de l'infra AWS (ECS Fargate ou EC2 + ALB) via IaC (Terraform ou CDK)
DEPLOY
Déploiement automatisé sur l'environnement staging avec health checks + smoke tests
DEPLOY
Mise en place du déploiement Blue/Green (zero-downtime) sur production
CI
Intégration des feature flags (Unleash ou équivalent) — validation sur 1 fonctionnalité
DEPLOY
Test de rollback : simuler un échec en prod et mesurer le temps de retour (objectif < 10 min)
Livrable J3
Infra cloud opérationnelle + déploiement Blue/Green + feature flag démontré + rollback chronométré

4
Jour 4
Monitoring,
Alerting & Ops
OPS
Déploiement du stack monitoring : Prometheus + Grafana (ou Datadog) sur les services
OPS
Définition et création des dashboards : latence P99, taux d'erreur, CPU/RAM, saturation
OPS
Configuration des alertes : Slack + PagerDuty — seuils définis et testés (simulation)
DOC
Rédaction du Runbook d'incident : procédure step-by-step du P1 au rollback
DOC
Documentation OpenAPI / Swagger pour les 4 services — schéma complet, exemples, auth
Livrable J4
Dashboard Grafana opérationnel + alerting testé + Runbook incident + doc OpenAPI complète

5
Jour 5
Documentation finale
& Soutenance
DOC
Finalisation du README complet : architecture, onboarding, variables d'env, contrib guide
DOC
Rapport technique (PDF) : décisions d'architecture, métriques de qualité, post-mortem incident P1
SOUT
Préparation du support de soutenance (12 slides max) + répétition démo pipeline
SOUT
Soutenance : 25 min présentation + démo live du pipeline + 15 min Q&A jury
Démo live obligatoire
Le jury pousse un commit en direct. L'équipe montre le pipeline s'exécuter jusqu'en production, puis déclenche un rollback. Tout doit fonctionner en temps réel.

Ce que vous rendez
Les 6 livrables
⚙️
L1 — Pipeline CI/CD complet
GitHub Actions · 5 stages · Docker
Workflow YAML versionné, documenté, commenté
5 stages : Build, Test, Security, Staging, Prod
Stratégie de branchement documentée et appliquée
Historique de runs propre visible dans l'UI CI
⏰ État requis dès J3 — finalisé J5 matin
🧪
L2 — Suite de tests automatisés
Jest · Playwright · Coverage ≥ 80%
Tests unitaires sur toutes les routes back-end critiques
Tests E2E sur 5 parcours utilisateurs clés
Rapport de coverage généré automatiquement en CI
Plan de tests rédigé (stratégie, scénarios, données de test)
⏰ Opérationnel fin J2
🚀
L3 — Infra Cloud & Déploiement
AWS ECS · Blue/Green · Feature Flags
Infrastructure provisionnée via IaC (Terraform ou CDK)
Environnements staging et prod fonctionnels et séparés
Déploiement zero-downtime (Blue/Green ou Rolling)
Rollback démontré en moins de 10 minutes
⏰ Opérationnel fin J3
📊
L4 — Monitoring & Alerting
Prometheus · Grafana · Slack alerts
Dashboard Grafana avec les 4 golden signals (latence, trafic, erreurs, saturation)
Alertes configurées et testées (simulation d'anomalie)
Intégration Slack / PagerDuty opérationnelle
Runbook d'incident P1 avec procédure de rollback step-by-step
⏰ Opérationnel fin J4
📄
L5 — Documentation technique
OpenAPI · README · Rapport PDF
Documentation OpenAPI/Swagger de tous les endpoints des 4 services
README complet : setup, architecture, variables d'env, contribution guide
Rapport technique (PDF) : décisions, métriques, post-mortem incident P1
Tout en français + section résumé en anglais
⏰ Rendu J5 avant soutenance
🎤
L6 — Soutenance + Démo live
25 min · Démo commit → prod · Q&A 15 min
Présentation du contexte et des choix d'architecture (10 min)
Démo live : commit → pipeline → staging → prod sous les yeux du jury (10 min)
Démonstration du rollback chronométré (5 min)
Q&A jury : questions individuelles — 15 min
⏰ Jour 5 après-midi
Grille d'évaluation
Barème — 100 points
⚙️ Pipeline CI/CD — Architecture & qualité
25 pts
Complétude des 5 stages (tous opérationnels)
10 pts
Stratégie de branchement cohérente et documentée
6 pts
Qualité et lisibilité du YAML (commentaires, structure)
5 pts
Scan de sécurité intégré et résultats traités
4 pts
🧪 Tests automatisés
25 pts
Coverage ≥ 80% sur les routes critiques
10 pts
Plan de tests rédigé (stratégie, scénarios, données)
6 pts
Tests E2E Playwright — 5 scénarios fonctionnels
6 pts
Pertinence des cas de tests (happy path + edge cases)
3 pts
🚀 Déploiement & Infra Cloud
20 pts
Infra cloud opérationnelle (staging + prod séparés)
6 pts
Déploiement zero-downtime démontré
8 pts
Rollback fonctionnel en moins de 10 min
4 pts
Feature flags implémentés et démontrés
2 pts
📊 Monitoring & Documentation
20 pts
Dashboard Grafana — 4 golden signals opérationnels
6 pts
Alerting testé et fonctionnel (Slack / PagerDuty)
4 pts
Documentation OpenAPI complète (4 services)
4 pts
Runbook d'incident + README onboarding
4 pts
Rapport technique PDF (décisions + post-mortem)
2 pts
🎤 Soutenance & Démo live
10 pts
Démo pipeline live (commit → prod) sans accroc
4 pts
Clarté des choix d'architecture expliqués
2 pts
Maîtrise individuelle lors du Q&A (chaque membre)
4 pts
Total
100 pts
Bonus — jusqu'à +15 pts
+5 pts — Infra entièrement reproductible via IaC (Terraform ou AWS CDK) — aucune étape manuelle
+5 pts — Rapport technique rédigé entièrement en anglais (documentation bilingue)
+5 pts — SLO/SLA formalisés avec Error Budget calculé et dashboard dédié
Préparez vos réponses
Questions du jury
Format Q&A
Questions posées individuellement — chaque membre doit maîtriser l'intégralité du projet. Le jury peut ouvrir n'importe quel fichier du repo et demander des explications ligne par ligne.

⚙️ Pipeline & CI/CD
Pourquoi avoir choisi Git Flow plutôt que Trunk-based, ou inversement ?
Que se passe-t-il si le stage Security échoue à 23h un vendredi ? Qui est alerté, comment ?
Montrez-moi ce qui se passe dans votre pipeline si deux développeurs pushent en même temps
Comment avez-vous géré les secrets (tokens, passwords) dans votre YAML ?
🧪 Tests & Qualité
Votre coverage est à 83% — quelles sont les 17% de lignes non couvertes, et pourquoi ?
Décrivez précisément ce que teste ce test unitaire — ligne par ligne
Un test E2E échoue en CI mais passe en local. Comment déboguez-vous ça ?
Quelle est la différence entre un test d'intégration et un test E2E dans votre contexte ?
🚀 Déploiement & Ops
Simulez un rollback maintenant — montrez-moi chaque étape en live
Comment votre stratégie Blue/Green garantit-elle le zéro downtime sur les connexions WebSocket actives ?
Un utilisateur signale un bug en prod 10 minutes après votre dernier déploiement. Quelle est votre procédure ?
Comment scalez-vous votre infra si NovaTech passe de 8 000 à 80 000 utilisateurs ?
📄 Documentation & Monitoring
Un nouveau développeur rejoint l'équipe lundi — en combien de temps est-il autonome avec votre README ?
Votre alerte Grafana se déclenche à 3h du matin — que dit exactement votre runbook d'aller faire ?
Pourquoi avez-vous choisi ces 4 métriques pour votre dashboard — et pas d'autres ?
Votre doc OpenAPI est-elle générée automatiquement ou écrite à la main ? Pros/cons de chaque approche ?
