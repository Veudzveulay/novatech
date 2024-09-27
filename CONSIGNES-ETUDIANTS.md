# 📋 ShipIt — Prise en main du repo NovaTech HRFlow

Bienvenue sur le repository reçu de Théo Marchand la veille de votre arrivée.

## 🎯 Votre mission — Jour 1 matin

Avant de toucher une seule ligne de code : **auditer ce repo de fond en comble**.
Un audit rigoureux en J1 est la base de tout ce qui suivra.

## 📂 Structure du projet

```
novatech-hrflow/
├── .env                          ← à examiner en PRIORITÉ
├── .github/workflows/deploy.yml  ← le pipeline actuel
├── .gitignore                    ← est-il bien configuré ?
├── README.md                     ← quelle est sa qualité ?
├── docs/
│   ├── architecture.md
│   ├── audit-partech-septembre-2024.md  ← rapport d'audit Partech
│   └── incident-aout-2024.md           ← post-mortem P1
├── frontend/
├── nginx/hrflow.conf
├── scripts/deploy.sh
└── services/
    ├── api-gateway/
    ├── auth/           ← sécurité auth
    ├── conges/         ← gestion congés
    ├── paie/           ← calcul bulletins de paie
    └── recrutement/    ← candidatures
```

## 🔍 Grille d'audit J1 — à compléter en équipe

### A. Sécurité
- [ ] Y a-t-il des secrets, tokens ou mots de passe exposés ? Où ?
- [ ] Les endpoints sont-ils protégés par authentification ?
- [ ] Vulnérabilités dans le code (injection, CORS, upload, debug...) ?

### B. Historique Git — lisez-le entièrement
- [ ] `git log --oneline --all --graph` — combien de branches ? lesquelles ?
- [ ] Quels auteurs ont contribué ? Quels patterns dans leurs messages ?
- [ ] Y a-t-il des commits de revert ? Que révèlent-ils ?
- [ ] Y a-t-il des branches abandonnées ? Que contiennent-elles ?
- [ ] Quels fichiers ont le plus changé ? Pourquoi ?

### C. Pipeline CI/CD
- [ ] Que fait réellement le pipeline actuel ?
- [ ] Sur quelles branches se déclenche-t-il ?
- [ ] Qu'est-ce qui manque ?

### D. Infrastructure
- [ ] Comment se fait le déploiement aujourd'hui ? Risques ?
- [ ] Y a-t-il un monitoring ? Un alerting ? Des backups ?

### E. Documentation
- [ ] Le README est-il utilisable ?
- [ ] L'architecture est-elle documentée ?

## 📊 Livrable attendu fin de J1

1. **Liste priorisée des problèmes** (Critique / Élevé / Moyen / Faible)
2. **Schéma d'architecture** de l'existant (draw.io ou Excalidraw)
3. **Plan de remédiation** ordonné et justifié
4. **Architecture cible du pipeline** (5 stages)

> 💡 Lisez d'abord `docs/audit-partech-septembre-2024.md` et `docs/incident-aout-2024.md`.
> Ensuite faites votre propre analyse — vous trouverez des problèmes que Partech n'a pas listés.

## ⚠️ Règles
- Ne pas pusher sur `main` sans pipeline qui passe
- Ne pas déployer en production avant J3
- Documenter chaque décision
- Tous les membres doivent comprendre tout le code

*Document fourni le Jour 1 par Théo Marchand*
