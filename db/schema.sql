DROP TABLE IF EXISTS bulletins_paie CASCADE;
DROP TABLE IF EXISTS conges CASCADE;
DROP TABLE IF EXISTS candidats CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'employe',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE employees (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nom                   VARCHAR(120),
  prenom                VARCHAR(120),
  salaire_mensuel_brut  NUMERIC(10,2) NOT NULL DEFAULT 0,
  jours_conges_acquis   INTEGER       NOT NULL DEFAULT 25,
  created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE conges (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date_debut    DATE    NOT NULL,
  date_fin      DATE    NOT NULL,
  nombre_jours  INTEGER NOT NULL,
  motif         TEXT,
  -- Pas de contrainte CHECK sur statut : le code écrit 'en_attente' mais rien
  -- n'empêche une valeur arbitraire (aucune validation applicative).
  statut        VARCHAR(30) NOT NULL DEFAULT 'en_attente',
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE bulletins_paie (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mois         INTEGER,
  annee        INTEGER,
  data         JSONB   NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE candidats (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(120),
  prenom      VARCHAR(120),
  email       VARCHAR(255),
  poste       VARCHAR(160),
  cv_path     TEXT,
  statut      VARCHAR(50) DEFAULT 'nouveau',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conges_employee_statut ON conges (employee_id, statut);
CREATE INDEX idx_bulletins_employee ON bulletins_paie (employee_id);
CREATE INDEX idx_candidats_created ON candidats (created_at DESC);
