/**
 * SAL Variable Injection Engine
 * Injects session context into system prompts at runtime.
 * Supports dynamic variables, deal context, user prefs.
 */

export interface SessionVariables {
  session_id?: string
  user_name?: string
  entity?: string
  active_deal?: string
  priority_domain?: string
  crm_contact?: string
  active_task?: string
  user_role?: string
  deal_stage?: string
  deal_size?: string
  counterparty?: string
  jurisdiction?: string
  time_constraint?: string
  risk_tolerance?: string
  preferred_model?: string
  output_format?: string
  cognitive_mode?: string
  constraints?: string[]
  custom_vars?: Record<string, string>
}

const FIELD_MAP: Record<string, string> = {
  user_name: "ACTIVE_USER",
  entity: "ACTIVE_ENTITY",
  active_deal: "ACTIVE_DEAL",
  priority_domain: "PRIORITY_DOMAIN",
  crm_contact: "CRM_CONTACT",
  active_task: "ACTIVE_TASK",
  user_role: "USER_ROLE",
  deal_stage: "DEAL_STAGE",
  deal_size: "DEAL_SIZE",
  counterparty: "COUNTERPARTY",
  jurisdiction: "JURISDICTION",
  time_constraint: "TIME_CONSTRAINT",
  risk_tolerance: "RISK_TOLERANCE",
  preferred_model: "PREFERRED_MODEL",
  output_format: "OUTPUT_FORMAT",
  session_id: "SESSION_ID",
}

const MODE_MAP: Record<string, string> = {
  fast: "fast_synthesis",
  deep: "deep_analysis",
  agentic: "agentic_execution",
  creative: "creative_synthesis",
}

export function buildSystemPrompt(
  basePrompt: string,
  variables?: SessionVariables
): string {
  if (!variables) return basePrompt

  const sessionBlock = buildSessionBlock(variables)
  return `${basePrompt}\n\n${sessionBlock}`
}

function buildSessionBlock(variables: SessionVariables): string {
  const now = new Date()
  const timestamp = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const lines: string[] = [
    "<session_context>",
    `SESSION_TIMESTAMP: ${timestamp} ET`,
  ]

  // Map session variables to labels
  for (const [varKey, label] of Object.entries(FIELD_MAP)) {
    const value = variables[varKey as keyof SessionVariables]
    if (value && typeof value === "string") {
      lines.push(`${label}: ${value}`)
    }
  }

  // Custom variables
  const custom = variables.custom_vars
  if (custom && Object.keys(custom).length > 0) {
    lines.push("CUSTOM_VARS:")
    for (const [k, v] of Object.entries(custom)) {
      lines.push(`  ${k.toUpperCase()}: ${v}`)
    }
  }

  // Cognitive mode override
  if (variables.cognitive_mode) {
    const mode = MODE_MAP[variables.cognitive_mode] || variables.cognitive_mode
    lines.push(
      `COGNITIVE_MODE_OVERRIDE: ${mode} — Apply this mode unless problem signature demands escalation.`
    )
  }

  // Active constraints
  if (variables.constraints && variables.constraints.length > 0) {
    lines.push(`ACTIVE_CONSTRAINTS: ${variables.constraints.join(" | ")}`)
  }

  lines.push("</session_context>")
  return lines.join("\n")
}
