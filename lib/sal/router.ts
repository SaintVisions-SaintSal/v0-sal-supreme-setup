/**
 * SAL Model Router
 * Routes queries to the correct model based on
 * task signature detection. Uses Vercel AI Gateway.
 */

const CODE_SIGNALS = [
  "write code", "build", "implement", "fix bug",
  "debug", "function", "class", "api", "endpoint",
  "deploy", "script", "refactor", "typescript",
  "python", "react", "next.js", "sql"
]

const FAST_SIGNALS = [
  "what is", "who is", "when did", "how many",
  "define", "list the", "quick", "briefly"
]

const CONTRARIAN_SIGNALS = [
  "devil's advocate", "contrarian", "what am i missing",
  "blind spot", "challenge this", "what could go wrong"
]

export type TaskType = "reasoning" | "code" | "fast" | "contrarian"

export function detectTaskType(messages: { role: string; content: string }[]): TaskType {
  if (!messages.length) return "reasoning"

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (!lastUser) return "reasoning"

  const text = lastUser.content.toLowerCase()

  if (CODE_SIGNALS.some((s) => text.includes(s))) return "code"
  if (FAST_SIGNALS.some((s) => text.includes(s))) return "fast"
  if (CONTRARIAN_SIGNALS.some((s) => text.includes(s))) return "contrarian"

  return "reasoning"
}

// Model selection map (using Vercel AI Gateway model strings)
const MODEL_MAP: Record<TaskType, string> = {
  reasoning: "anthropic/claude-sonnet-4-20250514",
  code: "anthropic/claude-sonnet-4-20250514",
  fast: "anthropic/claude-haiku-3-5-20241022",
  contrarian: "anthropic/claude-sonnet-4-20250514",
}

export function selectModel(taskType: TaskType, modelOverride?: string): string {
  if (modelOverride) return modelOverride
  return MODEL_MAP[taskType]
}
