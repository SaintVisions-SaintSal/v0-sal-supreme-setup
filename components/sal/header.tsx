"use client"

import { Activity, Zap } from "lucide-react"

export function SalHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  const tabs = [
    { id: "chat", label: "Chat" },
    { id: "registry", label: "Registry" },
    { id: "sessions", label: "Sessions" },
  ]

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-md bg-primary/10 border border-primary/20">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-wide">
            SAL SUPREME
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
            Saint Vision Technologies
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-emerald-500" />
        <span className="font-mono">v5.0</span>
        <span className="text-border">|</span>
        <span className="font-mono">Operational</span>
      </div>
    </header>
  )
}
