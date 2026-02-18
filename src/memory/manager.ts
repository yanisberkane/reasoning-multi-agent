import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateEmbedding } from "@/lib/embeddings";
import {
  storeMemoryEntries,
  searchMemoriesByVector,
  getMemoriesByUser,
  getMemoryCountByUser,
} from "@/db/memory";
import type { MemoryEntry } from "@/db/types";
import type { ExtractedMemory, AggregatedUserProfile } from "./types";

const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction specialist. Your role is to analyze a conversation between a user and a sales AI assistant, and extract observations about the user's communication preferences and style.

Extract SPECIFIC, ACTIONABLE observations. Focus on:
1. **Style**: Tone (formal/informal), language level, use of emojis, greeting style, sign-off preferences
2. **Format**: Preferred email structure, paragraph length, bullet points vs prose, subject line style
3. **Corrections**: If the user corrected or reformulated something the AI wrote, capture WHAT they changed and WHY
4. **Preferences**: Topics they emphasize, information they always include, things they avoid
5. **Behavior**: How they make decisions, what they prioritize, their workflow patterns

IMPORTANT RULES:
- Only extract observations that are clearly supported by the conversation
- Each observation must be specific enough to be actionable (not vague like "user is friendly")
- Rate confidence 0.0-1.0 based on how clearly the evidence supports the observation
- Corrections (user editing AI output) should ALWAYS be captured with high confidence
- If there is nothing meaningful to extract, return an empty array
- Return ONLY valid JSON, no other text

Respond with a JSON array of objects with this structure:
[
  {
    "category": "style" | "format" | "correction" | "preference" | "behavior",
    "content": "specific observation",
    "confidence": 0.0-1.0,
    "source": "extracted" | "correction"
  }
]`;

/**
 * Analyze a completed conversation turn and extract new observations about
 * the user's communication preferences. Uses a dedicated LLM call with a
 * specialized extraction prompt. The existing profile is passed in to avoid
 * duplicating already-known observations.
 */
export async function extractMemories(
  userMessage: string,
  assistantMessage: string,
  existingProfile: AggregatedUserProfile | null
): Promise<ExtractedMemory[]> {
  const profileContext = existingProfile
    ? `\n\nExisting user profile (avoid duplicating known observations):\n${JSON.stringify(existingProfile, null, 2)}`
    : "";

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: `Analyze this conversation and extract new memory observations.${profileContext}

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantMessage}

Extract observations as JSON array:`,
    });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const memories = JSON.parse(cleaned) as ExtractedMemory[];

    if (!Array.isArray(memories)) return [];

    return memories.filter(
      (m) =>
        m.category &&
        m.content &&
        typeof m.confidence === "number" &&
        m.confidence >= 0 &&
        m.confidence <= 1
    );
  } catch (error) {
    console.error("Memory extraction failed:", error);
    return [];
  }
}

/** Vectorize each extracted memory and persist them to MongoDB. */
export async function storeExtractedMemories(
  userId: string,
  memories: ExtractedMemory[]
): Promise<void> {
  if (memories.length === 0) return;

  const entries: MemoryEntry[] = [];

  for (const memory of memories) {
    try {
      const embedding = await generateEmbedding(memory.content);
      entries.push({
        userId,
        category: memory.category,
        content: memory.content,
        confidence: memory.confidence,
        embedding,
        createdAt: new Date(),
        source: memory.source,
      });
    } catch (error) {
      console.error("Failed to embed memory:", error);
    }
  }

  await storeMemoryEntries(entries);
}

/**
 * Build an aggregated user profile from stored memories.
 * 
 * Retrieves the most relevant memories via vector search (using the current
 * message as query), groups them by category, and sorts within each category
 * by: corrections first, then recency, then confidence score.
 * 
 * Returns an empty profile for first-time users (memoryCount === 0).
 */
export async function retrieveUserProfile(
  userId: string,
  currentMessage: string
): Promise<AggregatedUserProfile> {
  const memoryCount = await getMemoryCountByUser(userId);

  if (memoryCount === 0) {
    return {
      userId,
      communicationStyle: "No observations yet - first interaction",
      preferredFormats: "Unknown",
      corrections: "None recorded",
      preferences: "None recorded",
      behaviors: "None recorded",
      memoryCount: 0,
      rawMemories: [],
    };
  }

  let relevantMemories: MemoryEntry[] = [];

  try {
    const embedding = await generateEmbedding(currentMessage);
    relevantMemories = await searchMemoriesByVector(userId, embedding, 15);
  } catch {
    relevantMemories = await getMemoriesByUser(userId, 15);
  }

  const byCategory: Record<string, MemoryEntry[]> = {
    style: [],
    format: [],
    correction: [],
    preference: [],
    behavior: [],
  };

  for (const memory of relevantMemories) {
    if (byCategory[memory.category]) {
      byCategory[memory.category].push(memory);
    }
  }

  const sortByPriority = (entries: MemoryEntry[]) =>
    entries.sort((a, b) => {
      if (a.source === "correction" && b.source !== "correction") return -1;
      if (b.source === "correction" && a.source !== "correction") return 1;
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.confidence - a.confidence;
    });

  const summarize = (entries: MemoryEntry[], fallback: string) => {
    const sorted = sortByPriority(entries);
    if (sorted.length === 0) return fallback;
    return sorted.map((e) => `- ${e.content} (confidence: ${e.confidence})`).join("\n");
  };

  return {
    userId,
    communicationStyle: summarize(byCategory.style, "No style observations yet"),
    preferredFormats: summarize(byCategory.format, "No format preferences yet"),
    corrections: summarize(byCategory.correction, "No corrections recorded"),
    preferences: summarize(byCategory.preference, "No preferences recorded"),
    behaviors: summarize(byCategory.behavior, "No behavioral patterns yet"),
    memoryCount,
    rawMemories: relevantMemories.map((m) => `[${m.category}] ${m.content}`),
  };
}

/**
 * End-to-end post-interaction pipeline: retrieve existing profile,
 * extract new observations, vectorize and store them.
 * Called asynchronously after the response stream completes.
 */
export async function processPostInteraction(
  userId: string,
  userMessage: string,
  assistantMessage: string
): Promise<ExtractedMemory[]> {
  const existingProfile = await retrieveUserProfile(userId, userMessage);
  const memories = await extractMemories(userMessage, assistantMessage, existingProfile);
  await storeExtractedMemories(userId, memories);
  return memories;
}
