import { NextResponse } from "next/server"
import { getProject, updateProject, getProjectFiles, createSnapshot } from "@/lib/sal/projects"

// This would integrate with Vercel API for real deployments
// For now, we'll simulate the deployment process

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { vercelToken, teamId } = body

    const project = await getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const files = await getProjectFiles(projectId)
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files to deploy" },
        { status: 400 }
      )
    }

    // Update status to building
    await updateProject(projectId, { status: "building" })

    if (vercelToken) {
      // Real Vercel deployment
      try {
        // Create deployment via Vercel API
        const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: project.name.toLowerCase().replace(/\s+/g, "-"),
            files: files.map(f => ({
              file: f.path,
              data: f.content,
            })),
            projectSettings: {
              framework: project.framework === "nextjs" ? "nextjs" : null,
            },
            ...(teamId && { teamId }),
          }),
        })

        if (!deployResponse.ok) {
          const errorData = await deployResponse.json()
          await updateProject(projectId, { 
            status: "error", 
            build_logs: JSON.stringify(errorData) 
          })
          return NextResponse.json(
            { error: "Vercel deployment failed", details: errorData },
            { status: 500 }
          )
        }

        const deployData = await deployResponse.json()
        
        await updateProject(projectId, {
          status: "deployed",
          current_deploy_url: deployData.url,
          vercel_project_id: deployData.projectId,
          build_logs: `Deployed at ${new Date().toISOString()}`,
        })

        // Create deployment snapshot
        await createSnapshot({
          project_id: projectId,
          name: `Deploy ${new Date().toISOString().split("T")[0]}`,
          description: `Deployed to ${deployData.url}`,
        })

        return NextResponse.json({
          success: true,
          url: `https://${deployData.url}`,
          deploymentId: deployData.id,
        })
      } catch (deployError) {
        await updateProject(projectId, { 
          status: "error",
          build_logs: String(deployError),
        })
        throw deployError
      }
    } else {
      // Simulated deployment (no token provided)
      const simulatedUrl = `${project.name.toLowerCase().replace(/\s+/g, "-")}-${projectId.slice(0, 8)}.vercel.app`
      
      await updateProject(projectId, {
        status: "deployed",
        current_deploy_url: simulatedUrl,
        build_logs: `Simulated deployment at ${new Date().toISOString()}. Provide VERCEL_TOKEN for real deployments.`,
      })

      return NextResponse.json({
        success: true,
        url: `https://${simulatedUrl}`,
        simulated: true,
        message: "This is a simulated deployment. Add VERCEL_TOKEN env var for real deployments.",
      })
    }

  } catch (error) {
    console.error("Error deploying project:", error)
    return NextResponse.json(
      { error: "Failed to deploy project" },
      { status: 500 }
    )
  }
}

// Connect to GitHub repo
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await req.json()
    const { githubRepo, githubBranch, githubToken } = body

    const project = await getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!githubRepo) {
      return NextResponse.json(
        { error: "GitHub repo is required (format: owner/repo)" },
        { status: 400 }
      )
    }

    // Update project with GitHub info
    await updateProject(projectId, {
      github_repo: githubRepo,
      github_branch: githubBranch || "main",
    })

    // If token provided, push files to repo
    if (githubToken) {
      const files = await getProjectFiles(projectId)
      const branch = githubBranch || "main"

      // Get current commit SHA
      const refResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/git/ref/heads/${branch}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      )

      if (!refResponse.ok) {
        return NextResponse.json({
          success: true,
          message: "GitHub repo linked but could not push files. Check repo exists and token has permissions.",
          github_repo: githubRepo,
        })
      }

      const refData = await refResponse.json()
      const baseSha = refData.object.sha

      // Create tree with all files
      const treeResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/git/trees`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            base_tree: baseSha,
            tree: files.map(f => ({
              path: f.path,
              mode: "100644",
              type: "blob",
              content: f.content,
            })),
          }),
        }
      )

      if (!treeResponse.ok) {
        return NextResponse.json({
          success: true,
          message: "GitHub repo linked but tree creation failed.",
          github_repo: githubRepo,
        })
      }

      const treeData = await treeResponse.json()

      // Create commit
      const commitResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/git/commits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `SAL Supreme: Update from builder`,
            tree: treeData.sha,
            parents: [baseSha],
          }),
        }
      )

      if (!commitResponse.ok) {
        return NextResponse.json({
          success: true,
          message: "GitHub repo linked but commit creation failed.",
          github_repo: githubRepo,
        })
      }

      const commitData = await commitResponse.json()

      // Update ref
      await fetch(
        `https://api.github.com/repos/${githubRepo}/git/refs/heads/${branch}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            sha: commitData.sha,
          }),
        }
      )

      return NextResponse.json({
        success: true,
        message: "Files pushed to GitHub",
        github_repo: githubRepo,
        commit_sha: commitData.sha,
      })
    }

    return NextResponse.json({
      success: true,
      message: "GitHub repo linked",
      github_repo: githubRepo,
    })

  } catch (error) {
    console.error("Error connecting GitHub:", error)
    return NextResponse.json(
      { error: "Failed to connect GitHub" },
      { status: 500 }
    )
  }
}
