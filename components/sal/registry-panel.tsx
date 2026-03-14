"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Database,
  Plus,
  Star,
  Trash2,
  ChevronRight,
  X,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function RegistryPanel() {
  const { data, mutate, isLoading } = useSWR("/api/registry", fetcher)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const prompts = data?.prompts || []

  const handleSetDefault = async (key: string) => {
    await fetch(`/api/registry/${key}`, { method: "PATCH" })
    mutate()
  }

  const handleDeactivate = async (key: string) => {
    await fetch(`/api/registry/${key}`, { method: "DELETE" })
    mutate()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Prompt Registry
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            ({prompts.length})
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-xs text-muted-foreground">Loading registry...</div>
          </div>
        )}

        {!isLoading && prompts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <Database className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No prompts registered</p>
            <p className="text-xs text-muted-foreground/70">
              Seed the registry or create a new prompt
            </p>
          </div>
        )}

        {prompts.map((prompt: Record<string, unknown>) => (
          <div
            key={prompt.key as string}
            className="border-b border-border last:border-b-0"
          >
            <button
              onClick={() =>
                setExpandedKey(
                  expandedKey === (prompt.key as string) ? null : (prompt.key as string)
                )
              }
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  expandedKey === prompt.key ? "rotate-90" : ""
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {prompt.name as string}
                  </span>
                  {prompt.is_default && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full">
                      <Star className="h-2.5 w-2.5" />
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {prompt.key as string}
                  </span>
                  <span className="text-border">|</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    v{prompt.version as string}
                  </span>
                  <span className="text-border">|</span>
                  <span className="text-[10px] font-mono text-primary/80">
                    {prompt.domain as string}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {prompt.model as string}
              </span>
            </button>

            {expandedKey === prompt.key && (
              <div className="px-4 pb-3 pl-10">
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {(prompt.description as string) || "No description"}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-3">
                  <span>Max tokens: {prompt.max_tokens as number}</span>
                  <span className="text-border">|</span>
                  <span>
                    Tags:{" "}
                    {(prompt.tags as string[])?.length
                      ? (prompt.tags as string[]).join(", ")
                      : "none"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!prompt.is_default && (
                    <button
                      onClick={() => handleSetDefault(prompt.key as string)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition-colors"
                    >
                      <Star className="h-2.5 w-2.5" />
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeactivate(prompt.key as string)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-destructive border border-destructive/20 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    Deactivate
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreatePromptModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            mutate()
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

function CreatePromptModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    description: "",
    system_prompt: "",
    model: "claude-opus-4-5",
    domain: "full_spectrum",
    max_tokens: 8096,
    temperature: 0.7,
    tags: "",
  })
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create prompt")
      } else {
        onCreated()
      }
    } catch {
      setError("Network error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Register New Prompt
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Key</span>
              <input
                required
                value={formData.key}
                onChange={(e) => setFormData((d) => ({ ...d, key: e.target.value }))}
                className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                placeholder="sal_v5_custom"
              />
            </label>
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Domain</span>
              <select
                value={formData.domain}
                onChange={(e) => setFormData((d) => ({ ...d, domain: e.target.value }))}
                className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground outline-none focus:border-primary/50"
              >
                <option value="full_spectrum">Full Spectrum</option>
                <option value="finance">Finance</option>
                <option value="tech">Technology</option>
                <option value="operations">Operations</option>
                <option value="healthcare">Healthcare</option>
                <option value="legal">Legal</option>
                <option value="defense">Defense</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Name</span>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              placeholder="SAL Supreme v5.0 - Custom"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Description</span>
            <input
              value={formData.description}
              onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
              className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              placeholder="Custom prompt for..."
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">System Prompt</span>
            <textarea
              required
              rows={6}
              value={formData.system_prompt}
              onChange={(e) => setFormData((d) => ({ ...d, system_prompt: e.target.value }))}
              className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-y font-mono"
              placeholder="You are SAL..."
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Model</span>
              <input
                value={formData.model}
                onChange={(e) => setFormData((d) => ({ ...d, model: e.target.value }))}
                className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground outline-none focus:border-primary/50"
              />
            </label>
            <label className="w-28 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Max Tokens</span>
              <input
                type="number"
                value={formData.max_tokens}
                onChange={(e) => setFormData((d) => ({ ...d, max_tokens: Number(e.target.value) }))}
                className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground outline-none focus:border-primary/50"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Tags (comma separated)</span>
            <input
              value={formData.tags}
              onChange={(e) => setFormData((d) => ({ ...d, tags: e.target.value }))}
              className="px-3 py-2 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              placeholder="sal, v5, custom"
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-xs text-muted-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Register Prompt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
