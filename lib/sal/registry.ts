/**
 * SAL Prompt Registry
 * CRUD operations for prompt management.
 * Neon-backed with in-memory cache layer.
 */

import { getDb } from "@/lib/db"

interface PromptRecord {
  id: string
  key: string
  version: string
  name: string
  description: string | null
  system_prompt: string
  model: string
  max_tokens: number
  temperature: number
  domain: string
  tags: string[]
  is_active: boolean
  is_default: boolean
  token_count: number | null
  created_by: string
  created_at: string
  updated_at: string
}

// In-memory cache with TTL
const cache = new Map<string, { data: PromptRecord; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function cacheGet(key: string): PromptRecord | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expires) return entry.data
  if (entry) cache.delete(key)
  return null
}

function cacheSet(key: string, data: PromptRecord) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

function cacheInvalidate(key: string) {
  cache.delete(key)
}

export async function getPrompt(key: string): Promise<PromptRecord | null> {
  const cached = cacheGet(key)
  if (cached) return cached

  const sql = getDb()
  const rows = await sql`
    SELECT * FROM prompt_registry
    WHERE key = ${key} AND is_active = true
    LIMIT 1
  `
  if (rows.length > 0) {
    cacheSet(key, rows[0] as PromptRecord)
    return rows[0] as PromptRecord
  }
  return null
}

export async function getDefaultPrompt(): Promise<PromptRecord | null> {
  const cached = cacheGet("__default__")
  if (cached) return cached

  const sql = getDb()
  const rows = await sql`
    SELECT * FROM prompt_registry
    WHERE is_active = true AND is_default = true
    LIMIT 1
  `
  if (rows.length > 0) {
    cacheSet("__default__", rows[0] as PromptRecord)
    return rows[0] as PromptRecord
  }
  return null
}

export async function getPromptByDomain(domain: string): Promise<PromptRecord | null> {
  const cacheKey = `domain__${domain}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const sql = getDb()
  const rows = await sql`
    SELECT * FROM prompt_registry
    WHERE is_active = true AND domain = ${domain}
    ORDER BY version DESC
    LIMIT 1
  `
  if (rows.length > 0) {
    cacheSet(cacheKey, rows[0] as PromptRecord)
    return rows[0] as PromptRecord
  }
  return getDefaultPrompt()
}

export async function listPrompts(domain?: string, activeOnly = true) {
  const sql = getDb()

  if (domain && activeOnly) {
    return sql`
      SELECT key, version, name, description, domain, model, max_tokens,
             is_active, is_default, tags, created_at, updated_at
      FROM prompt_registry
      WHERE is_active = true AND domain = ${domain}
      ORDER BY domain, key
    `
  }
  if (activeOnly) {
    return sql`
      SELECT key, version, name, description, domain, model, max_tokens,
             is_active, is_default, tags, created_at, updated_at
      FROM prompt_registry
      WHERE is_active = true
      ORDER BY domain, key
    `
  }
  return sql`
    SELECT key, version, name, description, domain, model, max_tokens,
           is_active, is_default, tags, created_at, updated_at
    FROM prompt_registry
    ORDER BY domain, key
  `
}

export async function createPrompt(data: {
  key: string
  version?: string
  name: string
  description?: string
  system_prompt: string
  model?: string
  max_tokens?: number
  temperature?: number
  domain?: string
  tags?: string[]
  is_default?: boolean
}) {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO prompt_registry (key, version, name, description, system_prompt, model, max_tokens, temperature, domain, tags, is_default, created_by)
    VALUES (
      ${data.key},
      ${data.version || "5.0"},
      ${data.name},
      ${data.description || null},
      ${data.system_prompt},
      ${data.model || "claude-opus-4-5"},
      ${data.max_tokens || 8096},
      ${data.temperature || 0.7},
      ${data.domain || "full_spectrum"},
      ${data.tags || []},
      ${data.is_default || false},
      'system'
    )
    RETURNING *
  `
  if (rows.length > 0) {
    cacheSet(rows[0].key as string, rows[0] as PromptRecord)
  }
  return rows[0] as PromptRecord
}

export async function updatePrompt(key: string, updates: Record<string, unknown>) {
  const sql = getDb()

  // Build dynamic update — only update fields that are provided
  const allowedFields = [
    "name", "description", "system_prompt", "model",
    "max_tokens", "temperature", "tags", "is_active", "is_default"
  ]

  const setClauses: string[] = []
  const values: unknown[] = []

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = $${values.length + 2}`)
      values.push(updates[field])
    }
  }

  if (setClauses.length === 0) return null

  // Use raw query for dynamic updates
  const queryStr = `UPDATE prompt_registry SET ${setClauses.join(", ")}, updated_at = NOW() WHERE key = $1 RETURNING *`
  const rows = await sql(queryStr, [key, ...values])

  if (rows.length > 0) {
    cacheInvalidate(key)
    cacheSet(key, rows[0] as PromptRecord)
  }
  return rows[0] as PromptRecord || null
}

export async function deactivatePrompt(key: string) {
  const sql = getDb()
  const rows = await sql`
    UPDATE prompt_registry SET is_active = false, updated_at = NOW()
    WHERE key = ${key}
    RETURNING key
  `
  cacheInvalidate(key)
  return rows.length > 0
}

export async function setDefaultPrompt(key: string) {
  const sql = getDb()
  // Clear existing defaults
  await sql`UPDATE prompt_registry SET is_default = false WHERE is_default = true`
  // Set new default
  const rows = await sql`
    UPDATE prompt_registry SET is_default = true, updated_at = NOW()
    WHERE key = ${key}
    RETURNING key
  `
  cacheInvalidate("__default__")
  cacheInvalidate(key)
  return rows.length > 0
}

export type { PromptRecord }
