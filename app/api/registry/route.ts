/**
 * Prompt Registry API Routes — List & Create
 */

import { listPrompts, createPrompt, getPrompt } from "@/lib/sal/registry"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const domain = searchParams.get("domain") || undefined
  const activeOnly = searchParams.get("active_only") !== "false"

  const prompts = await listPrompts(domain, activeOnly)
  return Response.json({ prompts, count: prompts.length })
}

export async function POST(req: Request) {
  try {
    const data = await req.json()

    if (!data.key || !data.name || !data.system_prompt) {
      return Response.json(
        { error: "Missing required fields: key, name, system_prompt" },
        { status: 400 }
      )
    }

    const existing = await getPrompt(data.key)
    if (existing) {
      return Response.json(
        { error: `Prompt key already exists: ${data.key}` },
        { status: 409 }
      )
    }

    const created = await createPrompt(data)
    return Response.json({ success: true, prompt: created })
  } catch (error) {
    console.error("Registry create error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create prompt" },
      { status: 500 }
    )
  }
}
