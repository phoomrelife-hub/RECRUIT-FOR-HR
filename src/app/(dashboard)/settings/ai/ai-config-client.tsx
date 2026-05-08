"use client";

import { useState } from "react";
import { AI_TABS, type AiTab } from "@/components/ai-config/types";
import { OverviewTab } from "@/components/ai-config/overview-tab";
import { TaggingRulesTab } from "@/components/ai-config/tagging-rules-tab";
import { ScoringTab } from "@/components/ai-config/scoring-tab";
import { OpenClawRulesTab } from "@/components/ai-config/openclaw-rules-tab";
import { PlaygroundTab } from "@/components/ai-config/playground-tab";
import { LogsTab } from "@/components/ai-config/logs-tab";

function TabContent({ tab }: { tab: AiTab }) {
  switch (tab) {
    case "overview":        return <OverviewTab />;
    case "openclaw-rules":  return <OpenClawRulesTab />;
    case "tagging-rules":   return <TaggingRulesTab />;
    case "scoring":         return <ScoringTab />;
    case "playground":      return <PlaygroundTab />;
    case "logs":            return <LogsTab />;
    default:                return <OverviewTab />;
  }
}

export function AiConfigClient() {
  const [activeTab, setActiveTab] = useState<AiTab>("openclaw-rules");
  const [visible, setVisible] = useState(true);

  function handleTabChange(tab: AiTab) {
    if (tab === activeTab) return;
    setVisible(false);
    setTimeout(() => {
      setActiveTab(tab);
      setVisible(true);
    }, 80);
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-44 shrink-0">
        <nav className="space-y-0.5 sticky top-20">
          {AI_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div
        className="flex-1 min-w-0 transition-opacity duration-100"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <TabContent tab={activeTab} />
      </div>
    </div>
  );
}
