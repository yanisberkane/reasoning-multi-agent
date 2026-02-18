import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-small");

/** Generate a single 1536-dim embedding vector for a text string. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts, batched in groups of 100
 * to stay within API rate limits.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Convert a lead's key fields into a single text string suitable for embedding.
 * The resulting text captures name, role, company, industry, pipeline context,
 * deal value, interests, and interaction notes.
 */
export function leadToEmbeddingText(lead: {
  name: string;
  company: string;
  role: string;
  industry: string;
  interests: string[];
  notes: string;
  pipeline_stage: string;
  deal_value: number;
}): string {
  return [
    `${lead.name} - ${lead.role} at ${lead.company}`,
    `Industry: ${lead.industry}`,
    `Pipeline stage: ${lead.pipeline_stage}`,
    `Deal value: ${lead.deal_value}€`,
    `Interests: ${lead.interests.join(", ")}`,
    `Notes: ${lead.notes}`,
  ].join("\n");
}
