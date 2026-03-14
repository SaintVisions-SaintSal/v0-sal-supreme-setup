/**
 * Session Detail API — Get, Close, History
 */

import { getSession, closeSession, getHistory } from "@/lib/sal/session"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const { searchParams } = new URL(req.url)
  const includeHistory = searchParams.get("history") === "true"

  const session = await getSession(sessionId)
  if (!session) {
    return Response.json({ error: `Session not found: ${sessionId}` }, { status: 404 })
  }

  if (includeHistory) {
    const history = await getHistory(sessionId, 50)
    return Response.json({ ...session, messages: history })
  }

  return Response.json(session)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const success = await closeSession(sessionId)
  if (!success) {
    return Response.json({ error: `Session not found: ${sessionId}` }, { status: 404 })
  }
  return Response.json({ success: true, message: `Session closed: ${sessionId}` })
}
