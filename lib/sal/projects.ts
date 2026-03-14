import { sql } from "@/lib/db"

export interface Project {
  id: string
  name: string
  description: string | null
  framework: string
  user_id: string
  current_deploy_url: string | null
  status: "draft" | "building" | "deployed" | "error"
  build_logs: string | null
  metadata: Record<string, unknown>
  github_repo: string | null
  github_branch: string
  vercel_project_id: string | null
  current_version: number
  created_at: string
  updated_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  path: string
  content: string
  language: string | null
  is_ai_generated: boolean
  is_entry_point: boolean
  created_at: string
  updated_at: string
}

export interface ProjectSnapshot {
  id: string
  project_id: string
  generation_id: string | null
  version_number: number
  name: string | null
  description: string | null
  files_snapshot: { path: string; content: string; language?: string }[]
  prompt_used: string | null
  is_deployed: boolean
  deploy_url: string | null
  created_at: string
}

export interface Generation {
  id: string
  project_id: string
  session_id: string | null
  prompt: string
  model_used: string | null
  files_generated: number
  tokens_used: number
  status: "pending" | "running" | "complete" | "failed"
  error: string | null
  diff_summary: { path: string; action: "created" | "modified" | "deleted" }[]
  created_at: string
  completed_at: string | null
}

// ============ PROJECT CRUD ============

export async function createProject(data: {
  name: string
  description?: string
  framework?: string
  user_id?: string
}): Promise<Project> {
  const result = await sql`
    INSERT INTO projects (name, description, framework, user_id)
    VALUES (
      ${data.name},
      ${data.description || null},
      ${data.framework || "nextjs"},
      ${data.user_id || "cap"}
    )
    RETURNING *
  `
  return result[0] as Project
}

export async function getProject(id: string): Promise<Project | null> {
  const result = await sql`SELECT * FROM projects WHERE id = ${id}`
  return (result[0] as Project) || null
}

export async function listProjects(userId: string = "cap"): Promise<Project[]> {
  const result = await sql`
    SELECT * FROM projects 
    WHERE user_id = ${userId} 
    ORDER BY updated_at DESC
  `
  return result as Project[]
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, "name" | "description" | "status" | "build_logs" | "current_deploy_url" | "github_repo" | "github_branch" | "vercel_project_id" | "current_version">>
): Promise<Project | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`)
    values.push(data.name)
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`)
    values.push(data.description)
  }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`)
    values.push(data.status)
  }
  if (data.build_logs !== undefined) {
    sets.push(`build_logs = $${idx++}`)
    values.push(data.build_logs)
  }
  if (data.current_deploy_url !== undefined) {
    sets.push(`current_deploy_url = $${idx++}`)
    values.push(data.current_deploy_url)
  }
  if (data.github_repo !== undefined) {
    sets.push(`github_repo = $${idx++}`)
    values.push(data.github_repo)
  }
  if (data.github_branch !== undefined) {
    sets.push(`github_branch = $${idx++}`)
    values.push(data.github_branch)
  }
  if (data.vercel_project_id !== undefined) {
    sets.push(`vercel_project_id = $${idx++}`)
    values.push(data.vercel_project_id)
  }
  if (data.current_version !== undefined) {
    sets.push(`current_version = $${idx++}`)
    values.push(data.current_version)
  }

  if (sets.length === 0) return getProject(id)

  // Use template literal for simple update
  const result = await sql`
    UPDATE projects 
    SET name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        status = COALESCE(${data.status}, status),
        build_logs = COALESCE(${data.build_logs}, build_logs),
        current_deploy_url = COALESCE(${data.current_deploy_url}, current_deploy_url),
        github_repo = COALESCE(${data.github_repo}, github_repo),
        github_branch = COALESCE(${data.github_branch}, github_branch),
        vercel_project_id = COALESCE(${data.vercel_project_id}, vercel_project_id),
        current_version = COALESCE(${data.current_version}::integer, current_version)
    WHERE id = ${id}
    RETURNING *
  `
  return (result[0] as Project) || null
}

export async function deleteProject(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`
  return result.length > 0
}

// ============ PROJECT FILES ============

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const result = await sql`
    SELECT * FROM project_files 
    WHERE project_id = ${projectId}
    ORDER BY path
  `
  return result as ProjectFile[]
}

export async function getProjectFile(projectId: string, path: string): Promise<ProjectFile | null> {
  const result = await sql`
    SELECT * FROM project_files 
    WHERE project_id = ${projectId} AND path = ${path}
  `
  return (result[0] as ProjectFile) || null
}

export async function upsertProjectFile(data: {
  project_id: string
  path: string
  content: string
  language?: string
  is_ai_generated?: boolean
  is_entry_point?: boolean
}): Promise<ProjectFile> {
  const language = data.language || detectLanguage(data.path)
  
  const result = await sql`
    INSERT INTO project_files (project_id, path, content, language, is_ai_generated, is_entry_point)
    VALUES (
      ${data.project_id},
      ${data.path},
      ${data.content},
      ${language},
      ${data.is_ai_generated ?? true},
      ${data.is_entry_point ?? false}
    )
    ON CONFLICT (project_id, path) DO UPDATE SET
      content = EXCLUDED.content,
      language = EXCLUDED.language,
      is_ai_generated = EXCLUDED.is_ai_generated,
      updated_at = NOW()
    RETURNING *
  `
  return result[0] as ProjectFile
}

export async function deleteProjectFile(projectId: string, path: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM project_files 
    WHERE project_id = ${projectId} AND path = ${path}
    RETURNING id
  `
  return result.length > 0
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    html: "html",
    md: "markdown",
    py: "python",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
  }
  return langMap[ext || ""] || "plaintext"
}

// ============ SNAPSHOTS (VERSION HISTORY) ============

export async function createSnapshot(data: {
  project_id: string
  generation_id?: string
  name?: string
  description?: string
  prompt_used?: string
}): Promise<ProjectSnapshot> {
  // Get current files
  const files = await getProjectFiles(data.project_id)
  const filesSnapshot = files.map(f => ({
    path: f.path,
    content: f.content,
    language: f.language || undefined,
  }))

  // Get next version number
  const versionResult = await sql`
    SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
    FROM project_snapshots
    WHERE project_id = ${data.project_id}
  `
  const nextVersion = (versionResult[0] as { next_version: number }).next_version

  const result = await sql`
    INSERT INTO project_snapshots (
      project_id, generation_id, version_number, name, description, 
      files_snapshot, prompt_used
    )
    VALUES (
      ${data.project_id},
      ${data.generation_id || null},
      ${nextVersion},
      ${data.name || `v${nextVersion}`},
      ${data.description || null},
      ${JSON.stringify(filesSnapshot)},
      ${data.prompt_used || null}
    )
    RETURNING *
  `

  // Update project current version
  await sql`
    UPDATE projects SET current_version = ${nextVersion} WHERE id = ${data.project_id}
  `

  return result[0] as ProjectSnapshot
}

export async function getSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
  const result = await sql`
    SELECT * FROM project_snapshots
    WHERE project_id = ${projectId}
    ORDER BY version_number DESC
  `
  return result as ProjectSnapshot[]
}

export async function getSnapshot(snapshotId: string): Promise<ProjectSnapshot | null> {
  const result = await sql`SELECT * FROM project_snapshots WHERE id = ${snapshotId}`
  return (result[0] as ProjectSnapshot) || null
}

export async function rollbackToSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
  const snapshot = await getSnapshot(snapshotId)
  if (!snapshot || snapshot.project_id !== projectId) return false

  // Clear current files
  await sql`DELETE FROM project_files WHERE project_id = ${projectId}`

  // Restore files from snapshot
  const files = snapshot.files_snapshot as { path: string; content: string; language?: string }[]
  for (const file of files) {
    await upsertProjectFile({
      project_id: projectId,
      path: file.path,
      content: file.content,
      language: file.language,
      is_ai_generated: true,
    })
  }

  // Create a new snapshot marking the rollback
  await createSnapshot({
    project_id: projectId,
    name: `Rollback to v${snapshot.version_number}`,
    description: `Rolled back from v${snapshot.version_number}`,
  })

  return true
}

// ============ GENERATIONS ============

export async function createGeneration(data: {
  project_id: string
  session_id?: string
  prompt: string
  model_used?: string
}): Promise<Generation> {
  const result = await sql`
    INSERT INTO generations (project_id, session_id, prompt, model_used, status)
    VALUES (
      ${data.project_id},
      ${data.session_id || null},
      ${data.prompt},
      ${data.model_used || null},
      'pending'
    )
    RETURNING *
  `
  return result[0] as Generation
}

export async function updateGeneration(
  id: string,
  data: Partial<Pick<Generation, "status" | "files_generated" | "tokens_used" | "error" | "diff_summary">>
): Promise<Generation | null> {
  const result = await sql`
    UPDATE generations SET
      status = COALESCE(${data.status}, status),
      files_generated = COALESCE(${data.files_generated}::integer, files_generated),
      tokens_used = COALESCE(${data.tokens_used}::integer, tokens_used),
      error = COALESCE(${data.error}, error),
      diff_summary = COALESCE(${data.diff_summary ? JSON.stringify(data.diff_summary) : null}::jsonb, diff_summary),
      completed_at = CASE WHEN ${data.status} IN ('complete', 'failed') THEN NOW() ELSE completed_at END
    WHERE id = ${id}
    RETURNING *
  `
  return (result[0] as Generation) || null
}

export async function getGenerations(projectId: string): Promise<Generation[]> {
  const result = await sql`
    SELECT * FROM generations
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `
  return result as Generation[]
}

// ============ EXPORT / DOWNLOAD ============

export async function exportProjectAsZip(projectId: string): Promise<{ files: { path: string; content: string }[]; name: string }> {
  const project = await getProject(projectId)
  if (!project) throw new Error("Project not found")

  const files = await getProjectFiles(projectId)
  
  return {
    name: project.name.toLowerCase().replace(/\s+/g, "-"),
    files: files.map(f => ({ path: f.path, content: f.content })),
  }
}
