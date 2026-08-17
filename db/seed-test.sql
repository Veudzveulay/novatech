-- Jeu de données de test

TRUNCATE bulletins_paie, conges, candidats, employees, users RESTART IDENTITY CASCADE;

-- ── Utilisateurs ──────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password_hash, role) VALUES
  (1, 'rh@novatech.io',      '$2b$10$olBgwmMRJGspnLppUEf9h.SZiD3p5qp2kUA62FAyYAVU4foYIwysK', 'rh'),
  (2, 'employe@novatech.io', '$2b$10$0I4ALIlzMjoLQxh7hYkotOAwKPtCPDSA6GkfBzFtf.kb4/MIfbsNC', 'employe');
SELECT setval('users_id_seq', 2, true);

-- ── Employés ─────────────────────────────────────────────────────────────────
-- id=1 : cas nominal
-- id=2 : salaire à 0 (division / cotisations à zéro)
-- id=3 : solde de congés déjà épuisé
INSERT INTO employees (id, user_id, nom, prenom, salaire_mensuel_brut, jours_conges_acquis) VALUES
  (1, 1, 'Durand',  'Alice', 3000.00, 25),
  (2, 2, 'Martin',  'Bob',      0.00, 25),
  (3, NULL, 'Petit', 'Chloé', 2500.00,  5);
SELECT setval('employees_id_seq', 3, true);

-- ── Congés ───────────────────────────────────────────────────────────────────
-- Alice : 5 jours approuvés + 3 en attente  → solde attendu par le code = 20
-- Chloé : 5 jours approuvés sur 5 acquis    → solde = 0
INSERT INTO conges (employee_id, date_debut, date_fin, nombre_jours, motif, statut) VALUES
  (1, '2026-03-02', '2026-03-06', 5, 'Vacances hiver',  'approuve'),
  (1, '2026-08-10', '2026-08-12', 3, 'Congé été',       'en_attente'),
  (3, '2026-01-05', '2026-01-09', 5, 'Congé annuel',    'approuve');

-- ── Candidats ────────────────────────────────────────────────────────────────
INSERT INTO candidats (nom, prenom, email, poste, cv_path, statut, created_at) VALUES
  ('Nguyen', 'David', 'david.nguyen@example.test', 'Développeur backend', '/tmp/uploads/cv-david.pdf', 'nouveau',  '2026-07-01 09:00:00'),
  ('Lopez',  'Emma',  'emma.lopez@example.test',   'Data analyst',        '/tmp/uploads/cv-emma.pdf',  'entretien', '2026-07-15 09:00:00');
