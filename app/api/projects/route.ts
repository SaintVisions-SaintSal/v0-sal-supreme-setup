import { NextResponse } from "next/server"
import { createProject, listProjects } from "@/lib/sal/projects"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId") || "cap"
    
    const projects = await listProjects(userId)
    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Error listing projects:", error)
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, description, framework } = body

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    const project = await createProject({ name, description, framework })
    return NextResponse.json({ project })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    )
  }
}
