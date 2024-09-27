# 📜 Guide de lecture de l'historique Git — NovaTech HRFlow

Ce document vous guide dans la lecture de l'historique Git du projet.
**Lisez l'historique vous-mêmes d'abord** — ce fichier est un guide, pas une réponse.

## Commandes utiles pour explorer l'historique

```bash
# Vue d'ensemble de toutes les branches
git log --all --oneline --graph --decorate

# Historique détaillé avec auteurs et dates
git log --all --pretty=format:"%h | %an | %ad | %s" --date=short

# Voir qui a modifié quoi
git log --all --stat --oneline

# Voir les détails d'un commit spécifique
git show <hash>

# Voir l'évolution d'un fichier précis
git log --follow -p services/auth/src/index.js

# Chercher un mot-clé dans les messages de commit
git log --all --grep="TODO\|FIXME\|URGENT\|hotfix"

# Voir les branches abandonnées
git branch -a

# Comparer deux branches
git diff main..feature/recrutement-v2
```

## Ce que l'historique peut révéler

L'historique Git est une source d'information primaire pour votre audit.
Chaque message de commit, chaque auteur, chaque date raconte quelque chose.

Posez-vous ces questions en parcourant l'historique :
- Qui a le plus contribué ? Sur quels fichiers ?
- Y a-t-il des commits de revert ? Que s'est-il passé ?
- Les messages de commit mentionnent-ils des TODO non résolus ?
- Y a-t-il des branches jamais mergées ? Pourquoi ?
- Quels fichiers "sensibles" ont été commités à quelle date ?

*NovaTech HRFlow — Document de prise en main — Septembre 2024*
