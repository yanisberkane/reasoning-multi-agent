/** Raw observation extracted from a conversation by the memory extraction LLM. */
export interface ExtractedMemory {
  category: "style" | "format" | "correction" | "preference" | "behavior";
  /** Natural language description, e.g. "User prefers informal tone with emojis" */
  content: string;
  /** 0.0-1.0 how confidently the LLM inferred this observation */
  confidence: number;
  /** "correction" when the user explicitly reformulated AI output */
  source: "extracted" | "correction";
}

/**
 * Synthesized view of a user's preferences, built by aggregating
 * multiple MemoryEntry records grouped by category.
 * Injected into agent system prompts for personalization.
 */
export interface AggregatedUserProfile {
  userId: string;
  communicationStyle: string;
  preferredFormats: string;
  corrections: string;
  preferences: string;
  behaviors: string;
  /** Total stored observations -- drives the personalization progression */
  memoryCount: number;
  /** Flat list of raw memory strings for debugging */
  rawMemories: string[];
}
