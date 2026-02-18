import { streamText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { searchLeads, formatLeadForDisplay, formatLeadSummary } from "./lead-agent";
import { generateEmail, generateFollowUp } from "./writer-agent";
import { retrieveUserProfile } from "@/memory/manager";
import { getLeadById } from "@/db/leads";
import type { AggregatedUserProfile } from "@/memory/types";
import type { TraceCollector } from "@/lib/tracing";

function buildThinkerSystemPrompt(userProfile: AggregatedUserProfile): string {
  return `You are the Thinker agent — the central orchestrator of a multi-agent sales assistant system. You help sales professionals manage their leads and write personalized outreach.

## Your Role
You MUST follow this exact process for every request:

1. **THINK FIRST**: Always call the \`think\` tool before any other action. Analyze the user's request, identify what information is needed, and plan which agents to call.
2. **GATHER DATA**: Use \`searchLeads\` or \`getLeadDetails\` to find relevant lead information.
3. **GENERATE CONTENT**: If the user needs an email or message, use \`writeEmail\` or \`writeFollowUp\`.
4. **SYNTHESIZE**: Combine all gathered information into a clear, helpful response.

## Available Agents
- **Lead Agent** (via searchLeads, getLeadDetails): Searches and retrieves lead data from the CRM database
- **Writer Agent** (via writeEmail, writeFollowUp): Generates personalized sales emails and follow-ups

## User Memory Profile
${userProfile.memoryCount > 0 ? `This user has ${userProfile.memoryCount} recorded observations about their preferences:

**Communication Style:** ${userProfile.communicationStyle}
**Preferred Formats:** ${userProfile.preferredFormats}
**Corrections:** ${userProfile.corrections}
**Preferences:** ${userProfile.preferences}
**Behaviors:** ${userProfile.behaviors}

IMPORTANT: Use this profile to personalize your responses and the content you generate.` : "This is a new user with no recorded preferences yet. Respond naturally and the system will learn their style over time."}

## Response Guidelines
- Always respond in French unless explicitly asked otherwise
- Be concise but thorough
- When presenting leads, format them clearly
- When presenting emails, include the full email text
- Explain your reasoning when making decisions about which leads to target or what approach to take
- If the user's request is ambiguous, ask for clarification rather than guessing`;
}

const thinkInputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Your detailed chain-of-thought reasoning about the user's request"
    ),
  plan: z
    .array(z.string())
    .describe(
      "Ordered list of actions you plan to take"
    ),
  missingInfo: z
    .array(z.string())
    .describe(
      "Information that is missing and needs to be gathered"
    ),
});

const searchLeadsInputSchema = z.object({
  query: z
    .string()
    .describe("Natural language search query to find relevant leads"),
});

const getLeadDetailsInputSchema = z.object({
  leadId: z.string().describe("The MongoDB ObjectId of the lead"),
});

const writeEmailInputSchema = z.object({
  leadId: z.string().describe("The MongoDB ObjectId of the lead to email"),
  purpose: z
    .string()
    .describe(
      "The purpose of the email: 'first_contact', 'follow_up', 'proposal', 'meeting_request', 'thank_you', etc."
    ),
  context: z
    .string()
    .describe(
      "Additional context or specific instructions for the email"
    ),
});

const writeFollowUpInputSchema = z.object({
  leadId: z.string().describe("The MongoDB ObjectId of the lead"),
  previousContext: z
    .string()
    .describe(
      "Context about previous interactions or what was discussed before"
    ),
  additionalInstructions: z
    .string()
    .optional()
    .describe("Any specific instructions for the follow-up"),
});

export function createThinkerStream(
  messages: { role: "user" | "assistant"; content: string }[],
  userId: string,
  userProfile: AggregatedUserProfile,
  traceCollector: TraceCollector
) {
  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildThinkerSystemPrompt(userProfile),
    messages,
    stopWhen: stepCountIs(8),
    tools: {
      think: tool({
        description:
          "Use this tool to reason step by step about the user's request BEFORE taking any action. You MUST call this tool first for every request.",
        inputSchema: thinkInputSchema,
        execute: async (input: z.infer<typeof thinkInputSchema>) => {
          traceCollector.addThinkingStep({
            reasoning: input.reasoning,
            plan: input.plan,
            missingInfo: input.missingInfo,
            timestamp: Date.now(),
          });
          return {
            status: "reasoning_complete" as const,
            reasoning: input.reasoning,
            plan: input.plan,
            missingInfo: input.missingInfo,
          };
        },
      }),

      searchLeads: tool({
        description:
          "Search for leads in the CRM database. Use natural language queries like 'leads in fintech', 'qualified leads with high deal value', 'leads interested in automation'.",
        inputSchema: searchLeadsInputSchema,
        execute: async (input: z.infer<typeof searchLeadsInputSchema>) => {
          traceCollector.addToolCall({
            toolName: "searchLeads",
            args: { query: input.query },
            result: null,
            timestamp: Date.now(),
          });

          const results = await searchLeads(input.query);

          const formatted = results.leads.map((lead) => ({
            id: lead._id?.toString(),
            summary: formatLeadSummary(lead),
            details: formatLeadForDisplay(lead),
          }));

          traceCollector.toolCalls[traceCollector.toolCalls.length - 1].result = {
            count: formatted.length,
            method: results.searchMethod,
          };

          return {
            results: formatted,
            totalFound: formatted.length,
            searchMethod: results.searchMethod,
            query: results.query,
          };
        },
      }),

      getLeadDetails: tool({
        description:
          "Get full details about a specific lead by their ID. Use this when you need complete information about a lead found via search.",
        inputSchema: getLeadDetailsInputSchema,
        execute: async (input: z.infer<typeof getLeadDetailsInputSchema>) => {
          traceCollector.addToolCall({
            toolName: "getLeadDetails",
            args: { leadId: input.leadId },
            result: null,
            timestamp: Date.now(),
          });

          const lead = await getLeadById(input.leadId);
          if (!lead) {
            return { error: "Lead not found" as const, leadId: input.leadId };
          }

          const details = formatLeadForDisplay(lead);
          traceCollector.toolCalls[traceCollector.toolCalls.length - 1].result = {
            found: true,
            name: lead.name,
          };

          return { lead: details, raw: lead };
        },
      }),

      writeEmail: tool({
        description:
          "Generate a personalized email for a lead. The Writer agent will use the user's style preferences from memory to craft the email.",
        inputSchema: writeEmailInputSchema,
        execute: async (input: z.infer<typeof writeEmailInputSchema>) => {
          traceCollector.addToolCall({
            toolName: "writeEmail",
            args: { leadId: input.leadId, purpose: input.purpose, context: input.context },
            result: null,
            timestamp: Date.now(),
          });

          const lead = await getLeadById(input.leadId);
          if (!lead) {
            return { error: "Lead not found" as const, leadId: input.leadId };
          }

          const currentProfile = await retrieveUserProfile(userId, input.context);
          const email = await generateEmail({
            lead,
            purpose: input.purpose,
            context: input.context,
            userProfile: currentProfile,
          });

          traceCollector.toolCalls[traceCollector.toolCalls.length - 1].result = {
            generated: true,
            leadName: lead.name,
          };

          return { email, leadName: lead.name, purpose: input.purpose };
        },
      }),

      writeFollowUp: tool({
        description:
          "Generate a follow-up email for a lead. Considers how long since last contact and adapts the tone accordingly.",
        inputSchema: writeFollowUpInputSchema,
        execute: async (input: z.infer<typeof writeFollowUpInputSchema>) => {
          traceCollector.addToolCall({
            toolName: "writeFollowUp",
            args: { leadId: input.leadId, previousContext: input.previousContext },
            result: null,
            timestamp: Date.now(),
          });

          const lead = await getLeadById(input.leadId);
          if (!lead) {
            return { error: "Lead not found" as const, leadId: input.leadId };
          }

          const daysSince = Math.floor(
            (Date.now() - new Date(lead.last_contact).getTime()) / (1000 * 60 * 60 * 24)
          );

          const currentProfile = await retrieveUserProfile(userId, input.previousContext);
          const email = await generateFollowUp({
            lead,
            previousContext: input.previousContext,
            daysSinceLastContact: daysSince,
            userProfile: currentProfile,
            additionalInstructions: input.additionalInstructions,
          });

          traceCollector.toolCalls[traceCollector.toolCalls.length - 1].result = {
            generated: true,
            leadName: lead.name,
            daysSinceLastContact: daysSince,
          };

          return { email, leadName: lead.name, daysSinceLastContact: daysSince };
        },
      }),
    },
    onStepFinish(stepResult) {
      console.log(
        `[STEP] finishReason=${stepResult.finishReason}, toolCalls=${stepResult.toolCalls?.length ?? 0}`
      );
      if (stepResult.toolCalls) {
        for (const call of stepResult.toolCalls) {
          console.log(`  → ${call.toolName}`);
        }
      }
    },
  });

  return result;
}
