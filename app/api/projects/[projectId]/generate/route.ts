import { streamText } from "ai"
import { NextResponse } from "next/server"
import { 
  getProject, 
  getProjectFiles, 
  upsertProjectFile, 
  createGeneration, 
  updateGeneration,
  createSnapshot 
} from "@/lib/sal/projects"

const CODE_GENERATION_SYSTEM = `You are SAL, an expert full-stack developer AI that generates production-ready code.

When given a request, you will generate or modify files for a web application project.

IMPORTANT OUTPUT FORMAT:
You MUST respond with valid JSON containing an array of file operations:
{
  "files": [
    {
      "path": "app/page.tsx",
      "content": "// file content here",
      "action": "create" | "modify" | "delete"
    }
  ],
  "summary": "Brief description of changes made"
}

RULES:
1. Generate complete, working code - no placeholders or TODOs
2. Use TypeScript and Next.js App Router patterns
3. Use Tailwind CSS for styling
4. Include all necessary imports
5. Follow best practices for the framework
6. If modifying existing files, include the COMPLETE new file content
7. Use proper file paths (e.g., "app/page.tsx", "components/Button.tsx")

CURRENT PROJECT FILES:
{{PROJECT_FILES}}

Now generate code based on the user's request.`

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { prompt, sessionId } = body

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const project = await getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get existing files for context
    const existingFiles = await getProjectFiles(projectId)
    const filesContext = existingFiles.length > 0
      ? existingFiles.map(f => `--- ${f.path} ---\n${f.content}`).join("\n\n")
      : "No files yet - this is a new project."

    // Create generation record
    const generation = await createGeneration({
      project_id: projectId,
      session_id: sessionId,
      prompt,
      model_used: "anthropic/claude-sonnet-4",
    })

    await updateGeneration(generation.id, { status: "running" })

    // Generate code
    const systemPrompt = CODE_GENERATION_SYSTEM.replace("{{PROJECT_FILES}}", filesContext)

    const result = await streamText({
      model: "anthropic/claude-sonnet-4",
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 16000,
      temperature: 0.3,
    })

    // Collect the full response
    let fullResponse = ""
    for await (const chunk of result.textStream) {
      fullResponse += chunk
    }

    // Parse the response
    let parsed: { files: { path: string; content: string; action: string }[]; summary: string }
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No JSON found in response")
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      await updateGeneration(generation.id, { 
        status: "failed", 
        error: "Failed to parse AI response" 
      })
      return NextResponse.json(
        { error: "Failed to parse generated code", raw: fullResponse },
        { status: 500 }
      )
    }

    // Apply file changes
    const diffSummary: { path: string; action: "created" | "modified" | "deleted" }[] = []

    for (const file of parsed.files) {
      if (file.action === "delete") {
        // Handle delete
        diffSummary.push({ path: file.path, action: "deleted" })
      } else {
        const existingFile = existingFiles.find(f => f.path === file.path)
        await upsertProjectFile({
          project_id: projectId,
          path: file.path,
          content: file.content,
          is_ai_generated: true,
        })
        diffSummary.push({ 
          path: file.path, 
          action: existingFile ? "modified" : "created" 
        })
      }
    }

    // Update generation
    await updateGeneration(generation.id, {
      status: "complete",
      files_generated: parsed.files.length,
      diff_summary: diffSummary,
    })

    // Create version snapshot
    await createSnapshot({
      project_id: projectId,
      generation_id: generation.id,
      name: `Generation ${generation.id.slice(0, 8)}`,
      description: parsed.summary,
      prompt_used: prompt,
    })

    return NextResponse.json({
      success: true,
      generation_id: generation.id,
      files_changed: diffSummary,
      summary: parsed.summary,
    })

  } catch (error) {
    console.error("Error generating code:", error)
    return NextResponse.json(
      { error: "Failed to generate code" },
      { status: 500 }
    )
  }
}
