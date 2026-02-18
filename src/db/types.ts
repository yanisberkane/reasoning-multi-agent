import { ObjectId } from "mongodb";

/** Sales lead stored in the CRM database with vector embedding for semantic search. */
export interface Lead {
  _id?: ObjectId;
  name: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  /** Current position in the sales pipeline */
  pipeline_stage:
    | "prospect"
    | "qualified"
    | "proposal"
    | "negotiation"
    | "closed_won"
    | "closed_lost";
  /** Deal value in euros */
  deal_value: number;
  industry: string;
  /** Free-text history of interactions and context */
  notes: string;
  last_contact: Date;
  interests: string[];
  /** Range string, e.g. "50-200" */
  company_size: string;
  location: string;
  /** 1536-dim vector from text-embedding-3-small. Omitted in query results. */
  embedding?: number[];
}

/**
 * Single observation about a user's communication preferences.
 * Extracted by the Memory Manager after each interaction.
 */
export interface MemoryEntry {
  _id?: ObjectId;
  userId: string;
  /** What aspect of the user's behavior this observation captures */
  category: "style" | "format" | "correction" | "preference" | "behavior";
  /** Natural language description of the observation */
  content: string;
  /** 0.0-1.0 confidence score based on evidence strength */
  confidence: number;
  /** 1536-dim vector for semantic retrieval */
  embedding?: number[];
  createdAt: Date;
  /** "correction" entries take priority over "extracted" during aggregation */
  source: "extracted" | "correction";
}

/** Full record of a user-assistant interaction, including the Thinker's reasoning trace. */
export interface Interaction {
  _id?: ObjectId;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  thinkingTrace: ThinkingStep[];
  toolCalls: ToolCallRecord[];
  createdAt: Date;
}

/** One chain-of-thought reasoning step produced by the Thinker agent's `think()` tool. */
export interface ThinkingStep {
  reasoning: string;
  plan: string[];
  missingInfo: string[];
  timestamp: number;
}

/** Record of a single tool invocation made by the Thinker agent. */
export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

/** Aggregated view of a user's preferences, built from MemoryEntry records. */
export interface UserProfile {
  userId: string;
  communicationStyle: string;
  preferredFormats: string;
  corrections: string;
  preferences: string;
  behaviors: string;
  /** Total number of memory entries stored for this user */
  memoryCount: number;
}
