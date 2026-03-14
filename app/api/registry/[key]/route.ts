/**
 * Prompt Registry API — Get, Update, Deactivate by key
 */

import { getPrompt, updatePrompt, deactivatePrompt, setDefaultPrompt } from "@/lib/sal/registry"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const prompt = await getPrompt(key)
  if (!prompt) {
    return Response.json({ error: `Prompt not found: ${key}` }, { status: 404 })
  }
  return Response.json(prompt)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const updates = await req.json()

  const updated = await updatePrompt(key, updates)
  if (!updated) {
    return Response.json({ error: `Prompt not found: ${key}` }, { status: 404 })
  }
  return Response.json({ success: true, prompt: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const success = await deactivatePrompt(key)
  if (!success) {
    return Response.json({ error: `Prompt not found: ${key}` }, { status: 404 })
  }
  return Response.json({ success: true, message: `Deactivated: ${key}` })
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  // PATCH = set as default
  const { key } = await params
  const success = await setDefaultPrompt(key)
  if (!success) {
    return Response.json({ error: `Failed to set default: ${key}` }, { status: 404 })
  }
  return Response.json({ success: true, message: `${key} is now the default prompt` })
}
