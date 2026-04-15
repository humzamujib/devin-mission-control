-- Sessions table: tracks Devin session lifecycle
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'active',
    prompt          TEXT,
    repo            TEXT,
    branch          TEXT,
    pr_number       INTEGER,
    pr_url          TEXT,
    pr_status       TEXT,
    ci_status       TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_repo ON sessions(repo);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- PR cache: stores enriched PR data to reduce GitHub API calls
CREATE TABLE IF NOT EXISTS pr_cache (
    id              SERIAL PRIMARY KEY,
    repo            TEXT NOT NULL,
    pr_number       INTEGER NOT NULL,
    title           TEXT,
    author          TEXT,
    status          TEXT,
    ci_status       TEXT,
    review_status   TEXT,
    labels          JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data        JSONB,
    UNIQUE(repo, pr_number)
);

CREATE INDEX IF NOT EXISTS idx_pr_cache_repo ON pr_cache(repo);
CREATE INDEX IF NOT EXISTS idx_pr_cache_status ON pr_cache(status);

-- Config overrides: runtime feature flag overrides
CREATE TABLE IF NOT EXISTS config_overrides (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      TEXT
);

-- Daily metrics: aggregated stats for trend charts
CREATE TABLE IF NOT EXISTS daily_metrics (
    date            DATE NOT NULL,
    metric_name     TEXT NOT NULL,
    metric_value    NUMERIC NOT NULL DEFAULT 0,
    dimensions      JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (date, metric_name, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);

-- Vault session records: completed session history
CREATE TABLE IF NOT EXISTS vault_session_records (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    repo            TEXT,
    prompt          TEXT,
    result          TEXT,
    status          TEXT,
    source          TEXT,
    model           TEXT,
    duration_ms     INTEGER,
    cost_usd        NUMERIC,
    tools_used      JSONB DEFAULT '[]'::jsonb,
    messages        JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_session_records_completed ON vault_session_records(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_session_records_repo ON vault_session_records(repo);

-- Vault changelogs
CREATE TABLE IF NOT EXISTS vault_changelogs (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    source          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_changelogs_created ON vault_changelogs(created_at DESC);

-- Vault patterns (design patterns, knowledge)
CREATE TABLE IF NOT EXISTS vault_patterns (
    name            TEXT PRIMARY KEY,
    tags            JSONB DEFAULT '[]'::jsonb,
    repos           JSONB DEFAULT '[]'::jsonb,
    confidence      TEXT DEFAULT 'unknown',
    last_referenced TIMESTAMPTZ,
    reference_count INTEGER DEFAULT 0,
    body            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_patterns_repos ON vault_patterns USING GIN (repos);