import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Lead } from "@/db/types";
import type { AggregatedUserProfile } from "@/memory/types";

function buildWriterSystemPrompt(userProfile: AggregatedUserProfile): string {
  const hasMemory = userProfile.memoryCount > 0;

  return `You are an expert sales copywriter who writes emails and follow-up messages for sales professionals.

${
  hasMemory
    ? `## User Profile (CRITICAL - Adapt your writing to match this profile)

This user has ${userProfile.memoryCount} recorded observations about their preferences.

### Communication Style
${userProfile.communicationStyle}

### Preferred Formats
${userProfile.preferredFormats}

### Past Corrections (HIGHEST PRIORITY - Never repeat corrected patterns)
${userProfile.corrections}

### Preferences
${userProfile.preferences}

### Behavioral Patterns
${userProfile.behaviors}

IMPORTANT: Your output MUST reflect these preferences. The user should feel like you already know how they write. If they prefer informal tone, be informal. If they always include specific types of information, include them. If they corrected something before, make sure to apply that correction.`
    : `## First Interaction
No prior observations about this user's preferences. Write in a professional, warm French business style. The system will learn their preferences over time.`
}

## Rules
- Write in French unless the user explicitly asks for another language
- Keep the email professional but natural - not robotic
- Include a clear subject line prefixed with "Objet : "
- Structure the email with greeting, body, call-to-action, and sign-off
- Personalize based on the lead's context (industry, interests, pipeline stage)
- Adapt length and detail level based on user preferences (if known)
- Return ONLY the email content, no meta-commentary`;
}

export async function generateEmail(params: {
  lead: Lead;
  purpose: string;
  context: string;
  userProfile: AggregatedUserProfile;
  additionalInstructions?: string;
}): Promise<string> {
  const { lead, purpose, context, userProfile, additionalInstructions } = params;

  const prompt = `Write a ${purpose} email for this lead:

**Lead Profile:**
- Name: ${lead.name}
- Role: ${lead.role}
- Company: ${lead.company} (${lead.industry})
- Pipeline Stage: ${lead.pipeline_stage}
- Deal Value: ${lead.deal_value.toLocaleString("fr-FR")}€
- Interests: ${lead.interests.join(", ")}
- Last Contact: ${new Date(lead.last_contact).toLocaleDateString("fr-FR")}
- Notes: ${lead.notes}

**Context / Instructions:**
${context}
${additionalInstructions ? `\n**Additional Instructions:**\n${additionalInstructions}` : ""}`;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildWriterSystemPrompt(userProfile),
    prompt,
  });

  return text;
}

export async function generateFollowUp(params: {
  lead: Lead;
  previousContext: string;
  daysSinceLastContact: number;
  userProfile: AggregatedUserProfile;
  additionalInstructions?: string;
}): Promise<string> {
  const { lead, previousContext, daysSinceLastContact, userProfile, additionalInstructions } =
    params;

  const urgency =
    daysSinceLastContact > 14
      ? "gentle re-engagement after a period of silence"
      : daysSinceLastContact > 7
        ? "friendly follow-up"
        : "quick check-in follow-up";

  const prompt = `Write a ${urgency} follow-up email for this lead:

**Lead Profile:**
- Name: ${lead.name}
- Role: ${lead.role}
- Company: ${lead.company} (${lead.industry})
- Pipeline Stage: ${lead.pipeline_stage}
- Deal Value: ${lead.deal_value.toLocaleString("fr-FR")}€
- Interests: ${lead.interests.join(", ")}
- Last Contact: ${new Date(lead.last_contact).toLocaleDateString("fr-FR")} (${daysSinceLastContact} days ago)
- Notes: ${lead.notes}

**Previous Context:**
${previousContext}
${additionalInstructions ? `\n**Additional Instructions:**\n${additionalInstructions}` : ""}

Write a natural follow-up that references the previous interaction without being pushy.`;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildWriterSystemPrompt(userProfile),
    prompt,
  });

  return text;
}
