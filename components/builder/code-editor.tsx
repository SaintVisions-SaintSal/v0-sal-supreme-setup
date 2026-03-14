"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { 
  File, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Save,
  Plus,
  Trash2
} from "lucide-react"

interface ProjectFile {
  id: string
  path: string
  content: string
  language: string | null
}

interface CodeEditorProps {
  files: ProjectFile[]
  activeFile: string | null
  activeFileContent: string
  onSelectFile: (path: string) => void
  onSaveFile: (path: string, content: string) => Promise<void>
}

export function CodeEditor({
  files,
  activeFile,
  activeFileContent,
  onSelectFile,
  onSaveFile,
}: CodeEditorProps) {
  const [content, setContent] = useState(activeFileContent)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setContent(activeFileContent)
    setHasChanges(false)
  }, [activeFileContent, activeFile])

  const handleSave = useCallback(async () => {
    if (!activeFile || !hasChanges) return
    setIsSaving(true)
    try {
      await onSaveFile(activeFile, content)
      setHasChanges(false)
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setIsSaving(false)
    }
  }, [activeFile, content, hasChanges, onSaveFile])

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave])

  // Build file tree
  const fileTree = buildFileTree(files)

  return (
    <div className="flex h-full flex-col">
      {/* Tabs / File Info */}
      <div className="flex h-10 items-center justify-between border-b border-border bg-muted/30 px-2">
        <div className="flex items-center gap-2 text-sm">
          {activeFile && (
            <>
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{activeFile}</span>
              {hasChanges && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </>
          )}
        </div>
        {activeFile && hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 gap-1 text-xs"
          >
            <Save className="h-3 w-3" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File Tree */}
        <div className="w-56 overflow-y-auto border-r border-border bg-muted/20 p-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Files
            </span>
          </div>
          <FileTreeNode
            node={fileTree}
            activeFile={activeFile}
            onSelect={onSelectFile}
            depth={0}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {activeFile ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setHasChanges(true)
              }}
              className="h-full w-full resize-none bg-background p-4 font-mono text-sm text-foreground focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// File tree types and helpers
interface TreeNode {
  name: string
  path?: string
  children?: Record<string, TreeNode>
}

function buildFileTree(files: ProjectFile[]): TreeNode {
  const root: TreeNode = { name: "root", children: {} }

  for (const file of files) {
    const parts = file.path.split("/")
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1

      if (!current.children) {
        current.children = {}
      }

      if (!current.children[part]) {
        current.children[part] = isFile
          ? { name: part, path: file.path }
          : { name: part, children: {} }
      }

      if (!isFile) {
        current = current.children[part]
      }
    }
  }

  return root
}

interface FileTreeNodeProps {
  node: TreeNode
  activeFile: string | null
  onSelect: (path: string) => void
  depth: number
}

function FileTreeNode({ node, activeFile, onSelect, depth }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true)

  if (!node.children) return null

  const entries = Object.entries(node.children).sort(([, a], [, b]) => {
    // Folders first, then files
    const aIsFolder = !!a.children
    const bIsFolder = !!b.children
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div>
      {entries.map(([key, child]) => {
        const isFolder = !!child.children
        const isActive = child.path === activeFile

        if (isFolder) {
          return (
            <div key={key}>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <Folder className="h-4 w-4 text-primary" />
                <span className="text-foreground">{child.name}</span>
              </button>
              {expanded && (
                <FileTreeNode
                  node={child}
                  activeFile={activeFile}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              )}
            </div>
          )
        }

        return (
          <button
            key={key}
            onClick={() => child.path && onSelect(child.path)}
            className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm ${
              isActive ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
            }`}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
          >
            <File className="h-4 w-4 text-muted-foreground" />
            <span>{child.name}</span>
          </button>
        )
      })}
    </div>
  )
}
