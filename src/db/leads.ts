import { ObjectId } from "mongodb";
import { getDb } from "./client";
import type { Lead } from "./types";

const COLLECTION = "leads";

export async function searchLeadsByVector(
  embedding: number[],
  limit: number = 5
): Promise<Lead[]> {
  const db = await getDb();
  const collection = db.collection<Lead>(COLLECTION);

  try {
    const results = await collection
      .aggregate<Lead>([
        {
          $vectorSearch: {
            index: "leads_vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 50,
            limit,
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    return results;
  } catch {
    console.warn("Vector search failed, falling back to text search");
    return collection.find({}, { projection: { embedding: 0 } }).limit(limit).toArray();
  }
}

export async function searchLeadsByText(query: string, limit: number = 5): Promise<Lead[]> {
  const db = await getDb();
  const collection = db.collection<Lead>(COLLECTION);

  const regex = new RegExp(query, "i");
  return collection
    .find(
      {
        $or: [
          { name: regex },
          { company: regex },
          { industry: regex },
          { role: regex },
          { notes: regex },
          { interests: regex },
        ],
      },
      { projection: { embedding: 0 } }
    )
    .limit(limit)
    .toArray();
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const db = await getDb();
  const collection = db.collection<Lead>(COLLECTION);

  return collection.findOne(
    { _id: new ObjectId(id) },
    { projection: { embedding: 0 } }
  );
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDb();
  const collection = db.collection<Lead>(COLLECTION);
  return collection.find({}, { projection: { embedding: 0 } }).toArray();
}

export async function insertLeads(leads: Lead[]): Promise<void> {
  const db = await getDb();
  const collection = db.collection<Lead>(COLLECTION);
  await collection.deleteMany({});
  await collection.insertMany(leads);
}
