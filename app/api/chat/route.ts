/**
 * SAL Chat Endpoint
 * Core inference route with session management + streaming.
 */

import { streamText, convertToModelMessages } from "ai"
import {
  createSession,
  getSession,
  addMessage,
  getHistory,
  buildSessionSystemPrompt,
} from "@/lib/sal/session"
import { detectTaskType, selectModel } from "@/lib/sal/router"
import type { SessionVariables } from "@/lib/sal/injector"

interface Attachment {
  type: "image" | "file"
  mimeType: string
  url: string
  name: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, sessionId, promptKey, variables, attachments = [] } = body as {
      messages: { role: string; content: string; parts?: unknown[] }[]
      sessionId?: string
      promptKey?: string
      variables?: SessionVariables
      attachments?: Attachment[]
    }

    // 1. Session setup
    let session
    if (sessionId) {
      session = await getSession(sessionId)
      if (!session) {
        return Response.json({ error: `Session not found: ${sessionId}` }, { status: 404 })
      }
    } else {
      session = await createSession({
        userId: "cap",
        promptKey: promptKey || "sal_v5_full",
        variables,
      })
    }

    // 2. Build system prompt with session context injection
    const systemPrompt = await buildSessionSystemPrompt(session)

    // 3. Detect task type for model routing
    const plainMessages = messages.map((m) => ({
      role: m.role,
      content:
        typeof m.parts !== "undefined"
          ? (m.parts as { type: string; text: string }[])
              ?.filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("") || ""
          : (m.content as string) || "",
    }))
    const taskType = detectTaskType(plainMessages)
    const model = selectModel(taskType)

    // 4. Load history and merge with current messages
    const history = await getHistory(session.session_id, 50)
    const lastUserMsg = plainMessages[plainMessages.length - 1]

    // Save user message
    if (lastUserMsg && lastUserMsg.role === "user") {
      await addMessage({
        sessionId: session.session_id,
        role: "user",
        content: lastUserMsg.content,
      })
    }

    // Build messages array for the model
    const allMessages = [
      ...history,
      ...plainMessages.filter((m) => m.role === "user" || m.role === "assistant"),
    ]

    // Deduplicate — keep last N
    const deduped = allMessages.slice(-50)

    // 5. Build multi-modal messages if attachments present
    const imageAttachments = attachments.filter(a => a.type === "image" && a.url)
    
    // Build messages array - add images to last user message if present
    const modelMessages = deduped.map((m, idx) => {
      const isLastUserMessage = idx === deduped.length - 1 && m.role === "user"
      
      if (isLastUserMessage && imageAttachments.length > 0) {
        // Multi-modal message with images
        return {
          role: m.role as "user" | "assistant",
          content: [
            { type: "text" as const, text: m.content },
            ...imageAttachments.map(img => ({
              type: "image" as const,
              image: img.url,
            })),
          ],
        }
      }
      
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      }
    })

    // 6. Stream response
    const startTime = Date.now()

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 8096,
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse({
      onFinish: async ({ response }) => {
        const latency = Date.now() - startTime
        // Save assistant response
        const assistantText = response.messages
          .filter((m) => m.role === "assistant")
          .map((m) =>
            typeof m.content === "string"
              ? m.content
              : (m.content as { type: string; text: string }[])
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("")
          )
          .join("")

        if (assistantText) {
          await addMessage({
            sessionId: session.session_id,
            role: "assistant",
            content: assistantText,
            modelUsed: model,
            cognitiveMode: taskType,
            latencyMs: latency,
          })

          await import("@/lib/db").then(({ getDb }) => {
            const sql = getDb()
            return sql`UPDATE sessions SET last_model_used = ${model}, updated_at = NOW() WHERE session_id = ${session.session_id}`
          })
        }
      },
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
