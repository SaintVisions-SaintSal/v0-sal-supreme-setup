/**
 * SAL Session Manager
 * Handles conversation persistence, history loading,
 * and message storage. Neon-backed.
 */

import { randomUUID } from "crypto"
import { getDb } from "@/lib/db"
import { getPrompt, getDefaultPrompt } from "./registry"
import { buildSystemPrompt, type SessionVariables } from "./injector"

export interface Session {
  id: string
  session_id: string
  user_id: string
  prompt_key: string
  title: string | null
  entity: string
  active_deal: string | null
  priority_domain: string
  crm_contact: string | null
  active_task: string | null
  custom_vars: Record<string, string>
  message_count: number
  total_tokens: number
  last_model_used: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  model_used: string | null
  prompt_tokens: number
  completion_tokens: number
  cognitive_mode: string | null
  routed_to: string | null
  latency_ms: number | null
  created_at: string
}

// Session lifecycle

export async function createSession(params: {
  userId?: string
  promptKey?: string
  variables?: SessionVariables
}): Promise<Session> {
  const sql = getDb()
  const sessionId = `sal_${randomUUID().replace(/-/g, "").slice(0, 12)}`
  const vars = params.variables || {}

  const rows = await sql`
    INSERT INTO sessions (session_id, user_id, prompt_key, entity, active_deal, priority_domain, crm_contact, active_task, custom_vars, is_active)
    VALUES (
      ${sessionId},
      ${params.userId || "cap"},
      ${params.promptKey || "sal_v5_full"},
      ${(vars.entity as string) || "Saint Vision Technologies LLC"},
      ${(vars.active_deal as string) || null},
      ${(vars.priority_domain as string) || "full_spectrum"},
      ${(vars.crm_contact as string) || null},
      ${(vars.active_task as string) || null},
      ${JSON.stringify(vars.custom_vars || {})},
      true
    )
    RETURNING *
  `
  return rows[0] as Session
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM sessions WHERE session_id = ${sessionId} LIMIT 1
  `
  return (rows[0] as Session) || null
}

export async function listSessions(activeOnly = true) {
  const sql = getDb()
  if (activeOnly) {
    return sql`
      SELECT * FROM sessions WHERE is_active = true
      ORDER BY updated_at DESC
    `
  }
  return sql`SELECT * FROM sessions ORDER BY updated_at DESC`
}

export async function updateSession(sessionId: string, updates: Record<string, unknown>) {
  const sql = getDb()
  // Simple update for common fields
  if (updates.title !== undefined) {
    await sql`UPDATE sessions SET title = ${updates.title as string}, updated_at = NOW() WHERE session_id = ${sessionId}`
  }
  if (updates.is_active !== undefined) {
    await sql`UPDATE sessions SET is_active = ${updates.is_active as boolean}, updated_at = NOW() WHERE session_id = ${sessionId}`
  }
  if (updates.last_model_used !== undefined) {
    await sql`UPDATE sessions SET last_model_used = ${updates.last_model_used as string}, updated_at = NOW() WHERE session_id = ${sessionId}`
  }
  return getSession(sessionId)
}

export async function closeSession(sessionId: string) {
  const sql = getDb()
  const rows = await sql`
    UPDATE sessions SET is_active = false, updated_at = NOW()
    WHERE session_id = ${sessionId}
    RETURNING session_id
  `
  return rows.length > 0
}

// Message history

export async function addMessage(params: {
  sessionId: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  modelUsed?: string
  promptTokens?: number
  completionTokens?: number
  cognitiveMode?: string
  routedTo?: string
  latencyMs?: number
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO messages (session_id, role, content, model_used, prompt_tokens, completion_tokens, cognitive_mode, routed_to, latency_ms)
    VALUES (
      ${params.sessionId},
      ${params.role},
      ${params.content},
      ${params.modelUsed || null},
      ${params.promptTokens || 0},
      ${params.completionTokens || 0},
      ${params.cognitiveMode || null},
      ${params.routedTo || null},
      ${params.latencyMs || null}
    )
    RETURNING *
  `
  // Update session message count
  await sql`
    UPDATE sessions SET
      message_count = message_count + 1,
      total_tokens = total_tokens + ${(params.promptTokens || 0) + (params.completionTokens || 0)},
      updated_at = NOW()
    WHERE session_id = ${params.sessionId}
  `
  return rows[0] as Message
}

export async function getHistory(sessionId: string, limit = 50) {
  const sql = getDb()
  const rows = await sql`
    SELECT role, content, created_at
    FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as string, content: m.content as string }))
}

// System prompt builder

export async function buildSessionSystemPrompt(session: Session): Promise<string> {
  const promptKey = session.prompt_key || "sal_v5_full"
  let promptRecord = await getPrompt(promptKey)

  if (!promptRecord) {
    promptRecord = await getDefaultPrompt()
  }

  if (!promptRecord) {
    return FALLBACK_PROMPT
  }

  const variables: SessionVariables = {
    session_id: session.session_id,
    entity: session.entity,
    active_deal: session.active_deal || undefined,
    priority_domain: session.priority_domain,
    crm_contact: session.crm_contact || undefined,
    active_task: session.active_task || undefined,
    custom_vars: (session.custom_vars as Record<string, string>) || {},
  }

  return buildSystemPrompt(promptRecord.system_prompt, variables)
}

const FALLBACK_PROMPT = `You are SAL, Synthetic AGI Orchestration Platform for Saint Vision Technologies LLC. Operate with full domain expertise across finance, real estate, technology, healthcare, law, and government. Truth over confidence. Root cause over symptom. Proof over assertion.`
