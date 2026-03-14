"use client"

import { useState } from "react"
import { SalHeader } from "@/components/sal/header"
import { StatsBar } from "@/components/sal/stats-bar"
import { ChatPanel } from "@/components/sal/chat-panel"
import { RegistryPanel } from "@/components/sal/registry-panel"
import { SessionsPanel } from "@/components/sal/sessions-panel"

export default function SalCommandCenter() {
  const [activeTab, setActiveTab] = useState("chat")
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <SalHeader activeTab={activeTab} onTabChange={setActiveTab} />
      <StatsBar />

      <main className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "chat" && (
          <ChatPanel
            currentSessionId={currentSessionId}
            onSessionCreated={setCurrentSessionId}
          />
        )}

        {activeTab === "registry" && <RegistryPanel />}

        {activeTab === "sessions" && (
          <SessionsPanel
            onSelectSession={(id) => {
              setCurrentSessionId(id)
              setActiveTab("chat")
            }}
          />
        )}
      </main>
    </div>
  )
}
