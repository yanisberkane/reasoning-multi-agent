import { createThinkerStream } from "@/agents/thinker";
import { retrieveUserProfile, processPostInteraction } from "@/memory/manager";
import { storeInteraction } from "@/db/memory";
import { createTraceCollector } from "@/lib/tracing";
import { convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import type { Interaction } from "@/db/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();

  const rawMessages: UIMessage[] = body.messages ?? [];
  const messages = await convertToModelMessages(rawMessages);

  const userId: string = body.userId ?? "default-user";
  const lastUserMessage = rawMessages
    .filter((m) => m.role === "user")
    .pop()
    ?.parts?.filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("") ?? "";

  const userProfile = await retrieveUserProfile(userId, lastUserMessage);
  const traceCollector = createTraceCollector();

  const result = createThinkerStream(messages, userId, userProfile, traceCollector);

  const response = result.toUIMessageStreamResponse();

  const originalBody = response.body;
  if (!originalBody) return response;

  const [streamForClient, streamForCapture] = originalBody.tee();

  const capturePromise = (async () => {
    try {
      const reader = streamForCapture.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      let assistantMessage = "";
      const lines = fullText.split("\n");
      for (const line of lines) {
        if (line.startsWith("g:")) {
          try {
            const parsed = JSON.parse(line.slice(2));
            if (parsed.type === "text" && parsed.value) {
              assistantMessage += parsed.value;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (assistantMessage && lastUserMessage) {
        const trace = traceCollector.getTrace();

        const interaction: Interaction = {
          userId,
          userMessage: lastUserMessage,
          assistantMessage,
          thinkingTrace: trace.thinkingSteps,
          toolCalls: trace.toolCalls,
          createdAt: new Date(),
        };
        await storeInteraction(interaction);

        await processPostInteraction(userId, lastUserMessage, assistantMessage);

        console.log(
          `[MEMORY] Post-interaction processing complete for user ${userId}`
        );
      }
    } catch (error) {
      console.error("Post-interaction processing error:", error);
    }
  })();

  capturePromise.catch(console.error);

  return new Response(streamForClient, {
    headers: response.headers,
    status: response.status,
  });
}
