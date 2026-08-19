BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'employe',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id),
  nom                  VARCHAR(120),
  prenom               VARCHAR(120),
  salaire_mensuel_brut NUMERIC(10,2) NOT NULL DEFAULT 0,
  jours_conges_acquis  INTEGER NOT NULL DEFAULT 25,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conges (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  date_debut   DATE NOT NULL,
  date_fin     DATE NOT NULL,
  nombre_jours INTEGER NOT NULL,
  motif        TEXT,
  statut       VARCHAR(30) NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulletins_paie (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  mois        INTEGER,
  annee       INTEGER,
  data        JSONB NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidats (
  id         SERIAL PRIMARY KEY,
  nom        VARCHAR(120),
  prenom     VARCHAR(120),
  email      VARCHAR(255),
  poste      VARCHAR(160),
  cv_path    TEXT,
  statut     VARCHAR(50) DEFAULT 'nouveau',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conges_employee_statut
  ON conges (employee_id, statut);

CREATE INDEX IF NOT EXISTS idx_bulletins_employee
  ON bulletins_paie (employee_id);

CREATE INDEX IF NOT EXISTS idx_candidats_created
  ON candidats (created_at DESC);

COMMIT;
