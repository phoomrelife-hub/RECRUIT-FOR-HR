"use client";

import { useState } from "react";
import { AI_TABS, type AiTab } from "@/components/ai-config/types";
import { OverviewTab } from "@/components/ai-config/overview-tab";
import { ScreeningFlowTab } from "@/components/ai-config/screening-flow-tab";
import { PositionRulesTab } from "@/components/ai-config/position-rules-tab";
import { HandoffRulesTab } from "@/components/ai-config/handoff-rules-tab";
import { TaggingRulesTab } from "@/components/ai-config/tagging-rules-tab";
import { ScoringTab } from "@/components/ai-config/scoring-tab";
import { SummaryTemplatesTab } from "@/components/ai-config/summary-templates-tab";
import { OpenClawRulesTab } from "@/components/ai-config/openclaw-rules-tab";
import { PlaygroundTab } from "@/components/ai-config/playground-tab";
import { LogsTab } from "@/components/ai-config/logs-tab";
import { CostControlTab } from "@/components/ai-config/cost-control-tab";
import { FallbackTab } from "@/components/ai-config/fallback-tab";

function TabContent({ tab }: { tab: AiTab }) {
  switch (tab) {
    case "overview": return <OverviewTab />;
    case "openclaw-rules": return <OpenClawRulesTab />;
    case "screening-flow": return <ScreeningFlowTab />;
    case "position-rules": return <PositionRulesTab />;
    case "handoff-rules": return <HandoffRulesTab />;
    case "tagging-rules": return <TaggingRulesTab />;
    case "scoring": return <ScoringTab />;
    case "summary-templates": return <SummaryTemplatesTab />;
    case "playground": return <PlaygroundTab />;
    case "logs": return <LogsTab />;
    case "cost-control": return <CostControlTab />;
    case "fallback": return <FallbackTab />;
    default: return <OverviewTab />;
  }
}

export function AiConfigClient() {
  const [activeTab, setActiveTab] = useState<AiTab>("openclaw-rules");

  return (
    <div className="flex gap-6">
      {/* Sidebar tabs */}
      <div className="w-48 shrink-0">
        <nav className="space-y-0.5 sticky top-20">
          {AI_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* Tab content */}
      <div className="flex-1 min-w-0">
        <TabContent tab={activeTab} />
      </div>
    </div>
  );
}
