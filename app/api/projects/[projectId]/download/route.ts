import { NextResponse } from "next/server"
import { exportProjectAsZip } from "@/lib/sal/projects"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { files, name } = await exportProjectAsZip(projectId)

    // Return files as JSON - client will create ZIP
    return NextResponse.json({ 
      name,
      files,
      downloadInstructions: {
        method: "Use JSZip on client to create downloadable ZIP",
        files: files.length,
      }
    })
  } catch (error) {
    console.error("Error exporting project:", error)
    return NextResponse.json(
      { error: "Failed to export project" },
      { status: 500 }
    )
  }
}
