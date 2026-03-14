-- ============================================================
-- SAL SUPREME PRODUCTION SCHEMA
-- Saint Vision Technologies LLC
-- Neon PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: PROMPT REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_registry (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key             TEXT UNIQUE NOT NULL,
    version         TEXT NOT NULL DEFAULT '5.0',
    name            TEXT NOT NULL,
    description     TEXT,
    system_prompt   TEXT NOT NULL,
    model           TEXT NOT NULL DEFAULT 'claude-opus-4-5',
    max_tokens      INTEGER DEFAULT 8096,
    temperature     DOUBLE PRECISION DEFAULT 0.7,
    domain          TEXT DEFAULT 'full_spectrum',
    tags            TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    is_default      BOOLEAN DEFAULT false,
    token_count     INTEGER,
    created_by      TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_registry_key ON prompt_registry(key);
CREATE INDEX IF NOT EXISTS idx_prompt_registry_domain ON prompt_registry(domain);
CREATE INDEX IF NOT EXISTS idx_prompt_registry_active ON prompt_registry(is_active);

-- ============================================================
-- TABLE 2: SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id      TEXT UNIQUE NOT NULL,
    user_id         TEXT NOT NULL DEFAULT 'cap',
    prompt_key      TEXT REFERENCES prompt_registry(key),
    title           TEXT,
    entity          TEXT DEFAULT 'Saint Vision Technologies LLC',
    active_deal     TEXT,
    priority_domain TEXT DEFAULT 'full_spectrum',
    crm_contact     TEXT,
    active_task     TEXT,
    custom_vars     JSONB DEFAULT '{}',
    message_count   INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    last_model_used TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);

-- ============================================================
-- TABLE 3: MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id      TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content         TEXT NOT NULL,
    model_used      TEXT,
    prompt_tokens   INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    cognitive_mode  TEXT,
    routed_to       TEXT,
    tools_used      TEXT[] DEFAULT '{}',
    retrieval_used  BOOLEAN DEFAULT false,
    latency_ms      INTEGER,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

-- ============================================================
-- TABLE 4: LESSONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS lessons_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id      TEXT,
    error_type      TEXT NOT NULL,
    description     TEXT NOT NULL,
    root_cause      TEXT,
    rule_applied    TEXT NOT NULL,
    prevention_note TEXT,
    domain          TEXT,
    severity        TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
    applied_to_session BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_error_type ON lessons_log(error_type);
CREATE INDEX IF NOT EXISTS idx_lessons_domain ON lessons_log(domain);

-- ============================================================
-- TABLE 5: TOOL CALLS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_calls (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id      TEXT REFERENCES sessions(session_id),
    message_id      UUID REFERENCES messages(id),
    tool_name       TEXT NOT NULL,
    tool_tier       INTEGER,
    input_params    JSONB DEFAULT '{}',
    output_summary  TEXT,
    success         BOOLEAN DEFAULT true,
    error_message   TEXT,
    latency_ms      INTEGER,
    fallback_used   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_success ON tool_calls(success);

-- ============================================================
-- TABLE 6: SUBAGENT TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS subagent_tasks (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_session  TEXT REFERENCES sessions(session_id),
    parent_message  UUID REFERENCES messages(id),
    task_name       TEXT NOT NULL,
    team_assigned   TEXT NOT NULL,
    agent_assigned  TEXT,
    task_prompt     TEXT NOT NULL,
    task_status     TEXT DEFAULT 'pending' CHECK (task_status IN ('pending', 'running', 'complete', 'failed')),
    result          TEXT,
    error           TEXT,
    model_used      TEXT,
    tokens_used     INTEGER DEFAULT 0,
    latency_ms      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subagent_parent ON subagent_tasks(parent_session);
CREATE INDEX IF NOT EXISTS idx_subagent_status ON subagent_tasks(task_status);

-- ============================================================
-- AUTO-UPDATE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prompt_registry_updated_at ON prompt_registry;
CREATE TRIGGER trigger_prompt_registry_updated_at
    BEFORE UPDATE ON prompt_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_sessions_updated_at ON sessions;
CREATE TRIGGER trigger_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW active_sessions_view AS
SELECT 
    s.*,
    COUNT(m.id) as message_count_live,
    MAX(m.created_at) as last_message_at,
    COALESCE(SUM(m.prompt_tokens + m.completion_tokens), 0) as total_tokens_live
FROM sessions s
LEFT JOIN messages m ON s.session_id = m.session_id
WHERE s.is_active = true
GROUP BY s.id;

CREATE OR REPLACE VIEW prompt_registry_summary AS
SELECT 
    key, version, name, domain, model, 
    max_tokens, is_active, is_default,
    array_length(tags, 1) as tag_count,
    created_at, updated_at
FROM prompt_registry
WHERE is_active = true
ORDER BY is_default DESC, domain, key;
