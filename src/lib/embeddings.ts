import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-small");

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

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
