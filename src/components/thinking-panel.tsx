"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "result" | "partial-call";
  result?: unknown;
}

interface ThinkingPanelProps {
  toolInvocations: ToolInvocation[];
  isStreaming: boolean;
}

const TOOL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  think: { label: "Raisonnement", icon: "brain", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  searchLeads: { label: "Recherche leads", icon: "search", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  getLeadDetails: { label: "Détails lead", icon: "user", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  writeEmail: { label: "Rédaction email", icon: "mail", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  writeFollowUp: { label: "Relance", icon: "reply", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

const ICONS: Record<string, React.ReactNode> = {
  brain: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  search: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  user: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  mail: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  reply: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
};

function ThinkingContent({ args }: { args: Record<string, unknown> }) {
  const reasoning = args.reasoning as string;
  const plan = args.plan as string[];
  const missingInfo = args.missingInfo as string[];

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1">Raisonnement</div>
        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{reasoning}</p>
      </div>
      {plan && plan.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Plan d&apos;action</div>
          <ol className="text-sm text-foreground/80 space-y-0.5 list-decimal list-inside">
            {plan.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {missingInfo && missingInfo.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Informations manquantes</div>
          <ul className="text-sm text-foreground/80 space-y-0.5 list-disc list-inside">
            {missingInfo.map((info, i) => (
              <li key={i}>{info}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ToolCallContent({ toolName, args, result, state }: {
  toolName: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown> | string | null;
  state: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (toolName === "think") {
    return <ThinkingContent args={args} />;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground/80">
        {toolName === "searchLeads" && `Recherche : "${args.query}"`}
        {toolName === "getLeadDetails" && `Lead ID : ${args.leadId}`}
        {toolName === "writeEmail" && `Email ${args.purpose} pour le lead`}
        {toolName === "writeFollowUp" && `Relance pour le lead`}
      </div>
      {state === "result" && result && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {expanded ? "Masquer" : "Voir"} le résultat
          </button>
          {expanded && (
            <pre className="mt-2 text-xs text-muted-foreground bg-background/50 rounded-md p-2 overflow-x-auto max-h-48 overflow-y-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
      {state === "call" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          En cours...
        </div>
      )}
    </div>
  );
}

export function ThinkingPanel({ toolInvocations, isStreaming }: ThinkingPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!toolInvocations || toolInvocations.length === 0) return null;

  const hasActiveCall = toolInvocations.some((t) => t.state === "call");

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="flex items-center gap-1.5">
          {hasActiveCall || isStreaming ? (
            <>
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              Agent en action...
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              Trace de raisonnement ({toolInvocations.length} étapes)
            </>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-border">
          {toolInvocations.map((invocation, index) => {
            const toolInfo = TOOL_LABELS[invocation.toolName] || {
              label: invocation.toolName,
              icon: "brain",
              color: "bg-muted text-muted-foreground",
            };

            return (
              <div key={index} className="space-y-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${toolInfo.color} flex items-center gap-1 w-fit`}
                >
                  {ICONS[toolInfo.icon]}
                  {toolInfo.label}
                </Badge>
                <div className="pl-1">
                  <ToolCallContent
                    toolName={invocation.toolName}
                    args={invocation.args}
                    result={invocation.result as Record<string, unknown> | string | null | undefined}
                    state={invocation.state}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
