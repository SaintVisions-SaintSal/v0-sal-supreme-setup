"use client"

import useSWR from "swr"
import { MessageSquare, Clock, XCircle, Hash, Cpu } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function SessionsPanel({
  onSelectSession,
}: {
  onSelectSession: (sessionId: string) => void
}) {
  const { data, mutate, isLoading } = useSWR("/api/sessions", fetcher)
  const sessions = data?.sessions || []

  const handleClose = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
    mutate()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Active Sessions
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            ({sessions.length})
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-xs text-muted-foreground">
              Loading sessions...
            </div>
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No active sessions
            </p>
            <p className="text-xs text-muted-foreground/70">
              Start a chat to create your first session
            </p>
          </div>
        )}

        {sessions.map((session: Record<string, unknown>) => (
          <button
            key={session.session_id as string}
            onClick={() => onSelectSession(session.session_id as string)}
            className="w-full flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors text-left group"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary border border-border mt-0.5 shrink-0">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-foreground truncate">
                  {session.session_id as string}
                </span>
                <button
                  onClick={(e) => handleClose(session.session_id as string, e)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-primary/80 font-mono">
                  {session.priority_domain as string}
                </span>
                <span className="text-border">|</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {session.prompt_key as string}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5" />
                  {session.message_count as number} msgs
                </span>
                <span className="flex items-center gap-1">
                  <Cpu className="h-2.5 w-2.5" />
                  {((session.total_tokens as number) || 0).toLocaleString()} tokens
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {session.updated_at
                    ? formatDistanceToNow(new Date(session.updated_at as string), {
                        addSuffix: true,
                      })
                    : "just now"}
                </span>
              </div>
              {session.entity && (
                <div className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                  {session.entity as string}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
