import { NextResponse } from "next/server"
import { getSnapshots, createSnapshot, rollbackToSnapshot } from "@/lib/sal/projects"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const snapshots = await getSnapshots(projectId)
    return NextResponse.json({ versions: snapshots })
  } catch (error) {
    console.error("Error getting versions:", error)
    return NextResponse.json(
      { error: "Failed to get versions" },
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
    const { name, description, prompt_used, generation_id } = body

    const snapshot = await createSnapshot({
      project_id: projectId,
      generation_id,
      name,
      description,
      prompt_used,
    })

    return NextResponse.json({ version: snapshot })
  } catch (error) {
    console.error("Error creating version:", error)
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { snapshotId } = body

    if (!snapshotId) {
      return NextResponse.json(
        { error: "Snapshot ID is required for rollback" },
        { status: 400 }
      )
    }

    const success = await rollbackToSnapshot(projectId, snapshotId)
    if (!success) {
      return NextResponse.json(
        { error: "Rollback failed - snapshot not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: "Rolled back successfully" })
  } catch (error) {
    console.error("Error rolling back:", error)
    return NextResponse.json(
      { error: "Failed to rollback" },
      { status: 500 }
    )
  }
}
