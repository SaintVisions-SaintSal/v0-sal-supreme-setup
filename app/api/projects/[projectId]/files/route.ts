import { NextResponse } from "next/server"
import { getProjectFiles, upsertProjectFile, deleteProjectFile } from "@/lib/sal/projects"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const files = await getProjectFiles(projectId)
    return NextResponse.json({ files })
  } catch (error) {
    console.error("Error getting files:", error)
    return NextResponse.json(
      { error: "Failed to get files" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { path, content, language, is_entry_point } = body

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: "Path and content are required" },
        { status: 400 }
      )
    }

    const file = await upsertProjectFile({
      project_id: projectId,
      path,
      content,
      language,
      is_entry_point,
    })

    return NextResponse.json({ file })
  } catch (error) {
    console.error("Error saving file:", error)
    return NextResponse.json(
      { error: "Failed to save file" },
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
    const { searchParams } = new URL(req.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      )
    }

    const deleted = await deleteProjectFile(projectId, path)
    return NextResponse.json({ success: deleted })
  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    )
  }
}
