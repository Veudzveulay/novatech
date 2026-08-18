# Questions pour Théo Marchand

> Théo Marchand est disponible **1 h par jour maximum**. Ce fichier centralise
> les questions pour tenir un seul créneau quotidien, comme convenu dans
> `REPARTITION-EQUIPE.md` § 7.
>
> Questions issues du livrable **L2 (tests et sécurité)** — 23/07/2026.

---

## Prioritaires — bloquent la valeur des tests d'intégration

### Q1 · Quel est le schéma réel de la base de production ?

**Contexte** : le dépôt ne contient ni schéma, ni migration, ni seed.
`db/schema.sql` a été reconstitué par rétro-ingénierie des requêtes des
4 services. Il décrit ce que le code attend, pas nécessairement ce qui tourne.

**Précisément** :
1. Peux-tu fournir un `pg_dump --schema-only` de la base de production ?
2. Les colonnes suivantes existent-elles bien, et avec quels types ?
   `users(email, password_hash, role)`,
   `employees(salaire_mensuel_brut, jours_conges_acquis, updated_at)`,
   `conges(statut, nombre_jours)`,
   `bulletins_paie(data)`,
   `candidats(statut)`
3. Y a-t-il des contraintes (unicité, `CHECK`, clés étrangères) que le code
   ignore ? En particulier une unicité sur `(employee_id, mois, annee)` dans
   `bulletins_paie` ?

**Pourquoi ça compte** : sans réponse, les tests d'intégration valident le code
contre une base qui n'est peut-être pas celle de production.

---

### Q2 · Un export anonymisé de staging est-il disponible ?

**Contexte** : le plan de tests prévoyait des jeux de données issus de staging.
Aucun accès n'a été fourni, les données de test sont donc synthétiques.

**Précisément** :
1. Existe-t-il un environnement de staging joignable ?
2. Peut-on obtenir un export anonymisé (RGPD) de quelques centaines de lignes ?
3. À défaut : quels sont les **ordres de grandeur** ? Combien d'employés, de
   bulletins par mois, de candidats ?

---

## Importantes — éclairent des décisions du L2

### Q3 · Pourquoi le middleware d'authentification a-t-il été désactivé ?

**Contexte** : commit `06445bd` (« temp: désactivation middleware auth »,
Rayan, mars 2024). Le message invoque « un bug de token expiration ».

**7 tests unitaires établissent que ce bug n'existe pas** : jetons valides,
absents, malformés, signés avec un autre secret, expirés, expirant dans une
seconde — tous les cas sont traités correctement.

**Précisément** :
1. Le symptôme observé en mars 2024 est-il documenté quelque part ?
2. Le problème venait-il plutôt du **client** (jeton non rafraîchi côté
   frontend) que du middleware ?
3. Y a-t-il une raison de ne pas le réactiver dès la remédiation ?

---

### Q4 · La clé Stripe `sk_live_` du dépôt est-elle active ?

**Contexte** : `services/paie/src/app.js` retombe sur une clé `sk_live_...`
codée en dur si `STRIPE_SECRET_KEY` est absente. La route `/paie/calculer`
déclenche un virement réel.

**Précisément** :
1. Cette clé est-elle **encore valide** ? Si oui, c'est à révoquer aujourd'hui.
2. Même question pour les clés AWS, SendGrid et les identifiants SMTP du `.env`.
3. Qui a l'autorité pour les révoquer ?

**Urgence** : ces identifiants sont dans l'historique Git, donc dans toutes les
copies du dépôt déjà distribuées.

---

### Q5 · Existe-t-il un environnement où lancer les tests contre du réel ?

**Précisément** :
1. Une base de recette est-elle disponible, ou faut-il tout conteneuriser
   (choix retenu par défaut au L2) ?
2. Y a-t-il un compte Stripe **de test** utilisable, ou faut-il rester sur un
   double pour toujours ?

---

## Secondaires

### Q6 · Trois fonctionnalités mentionnées n'existent pas dans le code

Aucune trace — ni table, ni route, ni modèle — de :

1. la notion d'**offre d'emploi** (le recrutement ne gère que des candidatures) ;
2. l'**entretien annuel** ;
3. la **validation d'une demande de congé** (une demande est créée
   `en_attente`, rien ne permet de l'approuver).

**Précisément** : ont-elles existé puis été retirées, sont-elles prévues, ou
n'ont-elles jamais été développées ? La réponse détermine si les parcours E2E
correspondants sont à écrire ou à retirer du périmètre.

---

### Q7 · Quelle version de Node tourne en production ?

Le pipeline livré utilise Node 16, en fin de vie. La CI du L2 utilise Node 20.
Savoir ce qui tourne réellement en production évite une mauvaise surprise au
moment du déploiement du L3.
