"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import useSWR, { mutate } from "swr"
import { BuilderHeader } from "@/components/builder/header"
import { ChatSidebar } from "@/components/builder/chat-sidebar"
import { CodeEditor } from "@/components/builder/code-editor"
import { PreviewPanel } from "@/components/builder/preview-panel"
import { VersionHistory } from "@/components/builder/version-history"

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function BuilderPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const { data: projectData, error } = useSWR(
    projectId ? `/api/projects/${projectId}` : null,
    fetcher
  )

  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const project = projectData?.project
  const files = projectData?.files || []

  // Select first file by default
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      const entryFile = files.find((f: { is_entry_point: boolean }) => f.is_entry_point) || files[0]
      setActiveFile(entryFile.path)
    }
  }, [files, activeFile])

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Generation failed")
      }

      // Refresh project data
      mutate(`/api/projects/${projectId}`)
    } catch (err) {
      console.error("Generation error:", err)
      throw err
    } finally {
      setIsGenerating(false)
    }
  }, [projectId])

  const handleSaveFile = useCallback(async (path: string, content: string) => {
    await fetch(`/api/projects/${projectId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    })
    mutate(`/api/projects/${projectId}`)
  }, [projectId])

  const handleRollback = useCallback(async (snapshotId: string) => {
    await fetch(`/api/projects/${projectId}/versions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId }),
    })
    mutate(`/api/projects/${projectId}`)
    setShowVersions(false)
  }, [projectId])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-destructive">Failed to load project</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  const activeFileData = files.find((f: { path: string }) => f.path === activeFile)

  return (
    <div className="flex h-screen flex-col bg-background">
      <BuilderHeader 
        project={project} 
        onToggleVersions={() => setShowVersions(!showVersions)}
        showVersions={showVersions}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Sidebar */}
        <ChatSidebar 
          projectId={projectId}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />

        {/* Code Editor */}
        <div className="flex-1 border-x border-border">
          <CodeEditor
            files={files}
            activeFile={activeFile}
            activeFileContent={activeFileData?.content || ""}
            onSelectFile={setActiveFile}
            onSaveFile={handleSaveFile}
          />
        </div>

        {/* Preview / Version History */}
        {showVersions ? (
          <VersionHistory
            projectId={projectId}
            onRollback={handleRollback}
            onClose={() => setShowVersions(false)}
          />
        ) : (
          <PreviewPanel files={files} />
        )}
      </div>
    </div>
  )
}
