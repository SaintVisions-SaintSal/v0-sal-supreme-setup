"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Monitor, Smartphone, Tablet, RefreshCw, Code } from "lucide-react"

interface ProjectFile {
  path: string
  content: string
}

interface PreviewPanelProps {
  files: ProjectFile[]
}

type ViewMode = "desktop" | "tablet" | "mobile"

export function PreviewPanel({ files }: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop")
  const [showCode, setShowCode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Generate preview HTML from files
  const previewHtml = useMemo(() => {
    // Find the main page component
    const pageFile = files.find(f => 
      f.path === "app/page.tsx" || 
      f.path === "pages/index.tsx" ||
      f.path === "index.html"
    )

    if (!pageFile) {
      return `
        <html>
          <head>
            <style>
              body { 
                font-family: system-ui, sans-serif; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                margin: 0;
                background: #0a0a0a;
                color: #888;
              }
            </style>
          </head>
          <body>
            <p>No preview available. Generate some code to see it here.</p>
          </body>
        </html>
      `
    }

    // For a real implementation, you'd use a sandbox like Sandpack or CodeSandbox
    // For now, we'll show a code preview
    return `
      <html>
        <head>
          <style>
            body { 
              font-family: ui-monospace, monospace; 
              margin: 0;
              padding: 20px;
              background: #0a0a0a;
              color: #d4d4d4;
              font-size: 12px;
              line-height: 1.6;
              white-space: pre-wrap;
              word-break: break-all;
            }
            .file-header {
              color: #f59e0b;
              margin-bottom: 10px;
              font-weight: bold;
              border-bottom: 1px solid #333;
              padding-bottom: 5px;
            }
            .file-content {
              background: #1a1a1a;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              overflow-x: auto;
            }
          </style>
        </head>
        <body>
          <div class="file-header">${pageFile.path}</div>
          <div class="file-content">${escapeHtml(pageFile.content)}</div>
          ${files.filter(f => f.path !== pageFile.path).slice(0, 5).map(f => `
            <div class="file-header">${f.path}</div>
            <div class="file-content">${escapeHtml(f.content.slice(0, 500))}${f.content.length > 500 ? '...' : ''}</div>
          `).join('')}
        </body>
      </html>
    `
  }, [files, refreshKey])

  const viewModeStyles: Record<ViewMode, string> = {
    desktop: "w-full",
    tablet: "w-[768px] mx-auto",
    mobile: "w-[375px] mx-auto",
  }

  return (
    <div className="flex w-[400px] flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-2">
        <span className="text-sm font-medium text-foreground">Preview</span>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "tablet" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("tablet")}
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background p-2">
        <div className={`h-full transition-all ${viewModeStyles[viewMode]}`}>
          <iframe
            key={refreshKey}
            srcDoc={previewHtml}
            className="h-full w-full rounded-lg border border-border bg-background"
            sandbox="allow-scripts"
            title="Preview"
          />
        </div>
      </div>
    </div>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
