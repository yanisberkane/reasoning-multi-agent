import type { ThinkingStep, ToolCallRecord } from "@/db/types";

export interface TraceCollector {
  thinkingSteps: ThinkingStep[];
  toolCalls: ToolCallRecord[];
  addThinkingStep(step: ThinkingStep): void;
  addToolCall(call: ToolCallRecord): void;
  getTrace(): { thinkingSteps: ThinkingStep[]; toolCalls: ToolCallRecord[] };
}

export function createTraceCollector(): TraceCollector {
  const thinkingSteps: ThinkingStep[] = [];
  const toolCalls: ToolCallRecord[] = [];

  return {
    thinkingSteps,
    toolCalls,
    addThinkingStep(step: ThinkingStep) {
      thinkingSteps.push(step);
      console.log(`[THINK] ${step.reasoning.slice(0, 100)}...`);
      console.log(`[PLAN] ${step.plan.join(" → ")}`);
      if (step.missingInfo.length > 0) {
        console.log(`[MISSING] ${step.missingInfo.join(", ")}`);
      }
    },
    addToolCall(call: ToolCallRecord) {
      toolCalls.push(call);
      console.log(`[TOOL] ${call.toolName}(${JSON.stringify(call.args).slice(0, 100)})`);
    },
    getTrace() {
      return { thinkingSteps, toolCalls };
    },
  };
}

export interface StreamAnnotation {
  type: "thinking" | "tool_call" | "tool_result" | "memory_update";
  data: Record<string, unknown>;
  timestamp: number;
}
