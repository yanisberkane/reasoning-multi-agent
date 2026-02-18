import { ObjectId } from "mongodb";

export interface Lead {
  _id?: ObjectId;
  name: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  pipeline_stage:
    | "prospect"
    | "qualified"
    | "proposal"
    | "negotiation"
    | "closed_won"
    | "closed_lost";
  deal_value: number;
  industry: string;
  notes: string;
  last_contact: Date;
  interests: string[];
  company_size: string;
  location: string;
  embedding?: number[];
}

export interface MemoryEntry {
  _id?: ObjectId;
  userId: string;
  category: "style" | "format" | "correction" | "preference" | "behavior";
  content: string;
  confidence: number;
  embedding?: number[];
  createdAt: Date;
  source: "extracted" | "correction";
}

export interface Interaction {
  _id?: ObjectId;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  thinkingTrace: ThinkingStep[];
  toolCalls: ToolCallRecord[];
  createdAt: Date;
}

export interface ThinkingStep {
  reasoning: string;
  plan: string[];
  missingInfo: string[];
  timestamp: number;
}

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

export interface UserProfile {
  userId: string;
  communicationStyle: string;
  preferredFormats: string;
  corrections: string;
  preferences: string;
  behaviors: string;
  memoryCount: number;
}
