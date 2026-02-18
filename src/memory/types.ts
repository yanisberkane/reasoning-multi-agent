export interface ExtractedMemory {
  category: "style" | "format" | "correction" | "preference" | "behavior";
  content: string;
  confidence: number;
  source: "extracted" | "correction";
}

export interface AggregatedUserProfile {
  userId: string;
  communicationStyle: string;
  preferredFormats: string;
  corrections: string;
  preferences: string;
  behaviors: string;
  memoryCount: number;
  rawMemories: string[];
}
