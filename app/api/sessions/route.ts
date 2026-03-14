/**
 * Session Management API Routes — List & Create
 */

import { createSession, listSessions } from "@/lib/sal/session"

export async function GET() {
  const sessions = await listSessions(true)
  return Response.json({ sessions, count: sessions.length })
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const session = await createSession({
      userId: data.user_id || "cap",
      promptKey: data.prompt_key,
      variables: data,
    })
    return Response.json({ success: true, session })
  } catch (error) {
    console.error("Session create error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    )
  }
}
