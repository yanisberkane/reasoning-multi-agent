import "dotenv/config";
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { join } from "path";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import type { Lead } from "./types";
import { leadToEmbeddingText } from "../lib/embeddings";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "agentique";

async function seed() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI environment variable is not set");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    const db = client.db(DB_NAME);

    const leadsPath = join(process.cwd(), "data", "leads.json");
    const rawLeads = JSON.parse(readFileSync(leadsPath, "utf-8")) as Omit<Lead, "embedding">[];

    console.log(`Loaded ${rawLeads.length} leads from data/leads.json`);

    const embeddingModel = openai.embedding("text-embedding-3-small");
    const leadsWithEmbeddings: Lead[] = [];

    for (let i = 0; i < rawLeads.length; i++) {
      const lead = rawLeads[i];
      const text = leadToEmbeddingText(lead as Lead);
      const { embedding } = await embed({ model: embeddingModel, value: text });

      leadsWithEmbeddings.push({
        ...lead,
        last_contact: new Date(lead.last_contact),
        embedding,
      } as Lead);

      process.stdout.write(`\rGenerating embeddings: ${i + 1}/${rawLeads.length}`);
    }
    console.log("\nEmbeddings generated");

    const leadsCollection = db.collection("leads");
    await leadsCollection.deleteMany({});
    await leadsCollection.insertMany(leadsWithEmbeddings);
    console.log(`Inserted ${leadsWithEmbeddings.length} leads`);

    const memoriesCollection = db.collection("memories");
    await memoriesCollection.deleteMany({});
    console.log("Cleared memories collection");

    const interactionsCollection = db.collection("interactions");
    await interactionsCollection.deleteMany({});
    console.log("Cleared interactions collection");

    console.log("\n--- MongoDB Atlas Vector Search Index Setup ---");
    console.log("Create these indexes manually in MongoDB Atlas UI:");
    console.log("");
    console.log('1. Index name: "leads_vector_index"');
    console.log("   Collection: leads");
    console.log("   Definition:");
    console.log(
      JSON.stringify(
        {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: 1536,
              similarity: "cosine",
            },
          ],
        },
        null,
        2
      )
    );
    console.log("");
    console.log('2. Index name: "memories_vector_index"');
    console.log("   Collection: memories");
    console.log("   Definition:");
    console.log(
      JSON.stringify(
        {
          fields: [
            {
              type: "vector",
              path: "embedding",
              numDimensions: 1536,
              similarity: "cosine",
            },
            {
              type: "filter",
              path: "userId",
            },
          ],
        },
        null,
        2
      )
    );
    console.log("\nSeed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
