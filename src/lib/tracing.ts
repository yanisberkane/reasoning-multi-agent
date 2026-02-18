import type { ThinkingStep, ToolCallRecord } from "@/db/types";

/**
 * Accumulates thinking steps and tool calls during a Thinker agent run.
 * Used to build the full reasoning trace that gets stored in the
 * `interactions` collection and displayed in the UI.
 */
export interface TraceCollector {
  thinkingSteps: ThinkingStep[];
  toolCalls: ToolCallRecord[];
  addThinkingStep(step: ThinkingStep): void;
  addToolCall(call: ToolCallRecord): void;
  getTrace(): { thinkingSteps: ThinkingStep[]; toolCalls: ToolCallRecord[] };
}

/**
 * Creates a new trace collector that logs each step to the console
 * with structured prefixes ([THINK], [PLAN], [TOOL], etc.).
 */
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

/** Typed annotation sent to the client via stream for real-time tracing display. */
export interface StreamAnnotation {
  type: "thinking" | "tool_call" | "tool_result" | "memory_update";
  data: Record<string, unknown>;
  timestamp: number;
}
