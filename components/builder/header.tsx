"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  History, 
  Download, 
  Rocket, 
  Github, 
  ExternalLink,
  Loader2,
  Check
} from "lucide-react"

interface Project {
  id: string
  name: string
  status: string
  current_deploy_url: string | null
  github_repo: string | null
  current_version: number
}

interface BuilderHeaderProps {
  project: Project
  onToggleVersions: () => void
  showVersions: boolean
}

export function BuilderHeader({ project, onToggleVersions, showVersions }: BuilderHeaderProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)

  const handleDeploy = async () => {
    setIsDeploying(true)
    setDeploySuccess(false)
    try {
      const res = await fetch(`/api/projects/${project.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      
      if (res.ok) {
        setDeploySuccess(true)
        setTimeout(() => setDeploySuccess(false), 3000)
      }
    } catch (err) {
      console.error("Deploy failed:", err)
    } finally {
      setIsDeploying(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/download`)
      const data = await res.json()
      
      // Use JSZip to create download (loaded dynamically)
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      
      for (const file of data.files) {
        zip.file(file.path, file.content)
      }
      
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.name}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-foreground">{project.name}</h1>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            v{project.current_version}
          </span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            project.status === "deployed" 
              ? "bg-green-500/10 text-green-500" 
              : project.status === "building"
              ? "bg-yellow-500/10 text-yellow-500"
              : "bg-muted text-muted-foreground"
          }`}>
            {project.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={showVersions ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleVersions}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          History
        </Button>

        {project.github_repo && (
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <a href={`https://github.com/${project.github_repo}`} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
              Repo
            </a>
          </Button>
        )}

        {project.current_deploy_url && (
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <a href={`https://${project.current_deploy_url}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Preview
            </a>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="gap-2"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
        </Button>

        <Button
          size="sm"
          onClick={handleDeploy}
          disabled={isDeploying}
          className="gap-2"
        >
          {isDeploying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : deploySuccess ? (
            <Check className="h-4 w-4" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {deploySuccess ? "Deployed!" : "Deploy"}
        </Button>
      </div>
    </header>
  )
}
