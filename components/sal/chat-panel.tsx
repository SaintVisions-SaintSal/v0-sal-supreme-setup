"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Send,
  RotateCcw,
  Brain,
  Cpu,
  Gauge,
  AlertTriangle,
} from "lucide-react"
import type { UIMessage } from "ai"

const TASK_ICONS: Record<string, typeof Brain> = {
  reasoning: Brain,
  code: Cpu,
  fast: Gauge,
  contrarian: AlertTriangle,
}

function getUIMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export function ChatPanel({
  currentSessionId,
  onSessionCreated,
}: {
  currentSessionId: string | null
  onSessionCreated: (id: string) => void
}) {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          messages,
          sessionId: currentSessionId,
          id,
        },
      }),
    }),
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleNewChat = () => {
    setMessages([])
    onSessionCreated("")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">
            {currentSessionId ? `Session: ${currentSessionId}` : "New Session"}
          </span>
        </div>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 gap-4 flex flex-col">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="flex items-center justify-center h-16 w-16 mx-auto rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                SAL Supreme Ready
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                Full spectrum AI orchestration. Finance, tech, operations, legal, healthcare — all domains active.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const text = getUIMessageText(msg)
          if (!text) return null

          return (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{text}</div>
              </div>
            </div>
          )
        })}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-lg px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-3"
      >
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 focus-within:border-primary/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message SAL..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="flex items-center justify-center h-7 w-7 rounded-md bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
