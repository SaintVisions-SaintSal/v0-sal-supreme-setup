"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { 
  History, 
  RotateCcw, 
  X, 
  Clock, 
  GitCommit,
  Loader2,
  Check
} from "lucide-react"

interface Snapshot {
  id: string
  version_number: number
  name: string | null
  description: string | null
  prompt_used: string | null
  is_deployed: boolean
  deploy_url: string | null
  created_at: string
}

interface VersionHistoryProps {
  projectId: string
  onRollback: (snapshotId: string) => Promise<void>
  onClose: () => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function VersionHistory({ projectId, onRollback, onClose }: VersionHistoryProps) {
  const { data, error, isLoading } = useSWR(
    `/api/projects/${projectId}/versions`,
    fetcher
  )

  const [rollingBack, setRollingBack] = useState<string | null>(null)
  const [rollbackSuccess, setRollbackSuccess] = useState<string | null>(null)

  const handleRollback = async (snapshotId: string) => {
    setRollingBack(snapshotId)
    try {
      await onRollback(snapshotId)
      setRollbackSuccess(snapshotId)
      setTimeout(() => setRollbackSuccess(null), 2000)
    } catch (err) {
      console.error("Rollback failed:", err)
    } finally {
      setRollingBack(null)
    }
  }

  const versions = data?.versions || []

  return (
    <div className="flex w-[400px] flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Version History</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-destructive">
            Failed to load versions
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No versions yet. Generate code to create your first version.
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version: Snapshot, index: number) => (
              <div
                key={version.id}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <GitCommit className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {version.name || `v${version.version_number}`}
                        </span>
                        {index === 0 && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            Current
                          </span>
                        )}
                        {version.is_deployed && (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-500">
                            Deployed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(version.created_at)}
                      </div>
                    </div>
                  </div>

                  {index !== 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleRollback(version.id)}
                      disabled={rollingBack === version.id}
                    >
                      {rollingBack === version.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : rollbackSuccess === version.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Rollback
                    </Button>
                  )}
                </div>

                {version.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {version.description}
                  </p>
                )}

                {version.prompt_used && (
                  <div className="mt-2 rounded bg-background p-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Prompt: </span>
                    {version.prompt_used.slice(0, 100)}
                    {version.prompt_used.length > 100 && "..."}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString()
}
