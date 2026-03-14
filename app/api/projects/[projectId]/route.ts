import { NextResponse } from "next/server"
import { getProject, updateProject, deleteProject, getProjectFiles } from "@/lib/sal/projects"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const project = await getProject(projectId)
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const files = await getProjectFiles(projectId)
    return NextResponse.json({ project, files })
  } catch (error) {
    console.error("Error getting project:", error)
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    
    const project = await updateProject(projectId, body)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const deleted = await deleteProject(projectId)
    
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
}
