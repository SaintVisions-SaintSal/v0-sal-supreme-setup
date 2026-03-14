"use client"

import useSWR from "swr"
import { Activity, Database, MessageSquare, Cpu } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function StatsBar() {
  const { data: healthData } = useSWR("/api/health", fetcher, { refreshInterval: 30000 })
  const { data: sessionsData } = useSWR("/api/sessions", fetcher, { refreshInterval: 10000 })
  const { data: registryData } = useSWR("/api/registry", fetcher, { refreshInterval: 30000 })

  const stats = [
    {
      icon: Activity,
      label: "Status",
      value: healthData?.status || "checking...",
      color: healthData?.status === "operational" ? "text-emerald-500" : "text-amber-500",
    },
    {
      icon: Database,
      label: "Prompts",
      value: registryData?.count?.toString() || "0",
      color: "text-primary",
    },
    {
      icon: MessageSquare,
      label: "Sessions",
      value: sessionsData?.count?.toString() || "0",
      color: "text-primary",
    },
    {
      icon: Cpu,
      label: "Version",
      value: healthData?.version || "5.0.0",
      color: "text-muted-foreground",
    },
  ]

  return (
    <div className="flex items-center gap-6 px-6 py-2.5 border-b border-border bg-card/50">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-2">
          <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {stat.label}
          </span>
          <span className={`text-xs font-mono font-medium ${stat.color}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}
