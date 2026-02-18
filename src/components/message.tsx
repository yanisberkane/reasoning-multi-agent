"use client";

import type { UIMessage } from "ai";
import { ThinkingPanel } from "./thinking-panel";

interface MessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

interface ToolInvocationData {
  toolName: string;
  args: Record<string, unknown>;
  state: "call" | "result" | "partial-call";
  result?: unknown;
}

function extractToolInvocations(message: UIMessage): ToolInvocationData[] {
  const tools: ToolInvocationData[] = [];

  for (const part of message.parts) {
    if (part.type.startsWith("tool-") && part.type !== "tool-invocation") {
      const toolPart = part as unknown as {
        type: string;
        toolName: string;
        toolCallId: string;
        state: string;
        input?: unknown;
        output?: unknown;
      };

      const toolName = toolPart.type.replace("tool-", "");
      const state = toolPart.state === "output-available" ? "result" : "call";
      tools.push({
        toolName,
        args: (toolPart.input as Record<string, unknown>) ?? {},
        state,
        result: toolPart.output,
      });
    }

    if (part.type === "dynamic-tool") {
      const dynPart = part as unknown as {
        toolName: string;
        state: string;
        input?: unknown;
        output?: unknown;
      };
      const state = dynPart.state === "output-available" ? "result" : "call";
      tools.push({
        toolName: dynPart.toolName,
        args: (dynPart.input as Record<string, unknown>) ?? {},
        state,
        result: dynPart.output,
      });
    }
  }

  return tools;
}

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function formatContent(content: string): React.ReactNode {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="bg-background/50 border border-border rounded-md p-3 text-sm overflow-x-auto my-2 font-mono"
          >
            {codeContent.join("\n")}
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    if (line.startsWith("Objet : ") || line.startsWith("Objet: ")) {
      elements.push(
        <div key={i} className="font-semibold text-foreground border-b border-border pb-1 mb-2">
          {line}
        </div>
      );
      continue;
    }

    const formatted = line
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    elements.push(
      <p
        key={i}
        className={`${line === "" ? "h-2" : ""}`}
        dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }}
      />
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

export function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === "user";
  const content = getTextContent(message);
  const toolInvocations = isUser ? [] : extractToolInvocations(message);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`flex gap-3 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-linear-to-br from-purple-500 to-blue-600 text-white"
          }`}
        >
          {isUser ? "U" : "AI"}
        </div>

        <div className={`space-y-1 ${isUser ? "items-end" : "items-start"}`}>
          {toolInvocations.length > 0 && (
            <ThinkingPanel
              toolInvocations={toolInvocations}
              isStreaming={isStreaming || false}
            />
          )}

          {content && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border text-card-foreground rounded-bl-md"
              }`}
            >
              {isUser ? content : formatContent(content)}

              {isStreaming && !isUser && (
                <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 -mb-0.5" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
