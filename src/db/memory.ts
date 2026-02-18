import { getDb } from "./client";
import type { MemoryEntry, Interaction } from "./types";

const MEMORIES_COLLECTION = "memories";
const INTERACTIONS_COLLECTION = "interactions";

/** Bulk-insert memory entries. No-op if the array is empty. */
export async function storeMemoryEntries(entries: MemoryEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDb();
  const collection = db.collection<MemoryEntry>(MEMORIES_COLLECTION);
  await collection.insertMany(entries);
}

/**
 * Retrieve memories semantically relevant to the current context.
 * Uses Atlas Vector Search with a userId pre-filter so each user only
 * sees their own memories. Falls back to recency-based retrieval on error.
 */
export async function searchMemoriesByVector(
  userId: string,
  embedding: number[],
  limit: number = 10
): Promise<MemoryEntry[]> {
  const db = await getDb();
  const collection = db.collection<MemoryEntry>(MEMORIES_COLLECTION);

  try {
    const results = await collection
      .aggregate<MemoryEntry>([
        {
          $vectorSearch: {
            index: "memories_vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 50,
            limit: limit * 2,
            filter: { userId },
          },
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: "vectorSearchScore" },
          },
        },
        { $limit: limit },
      ])
      .toArray();

    return results;
  } catch {
    console.warn("Vector search failed for memories, falling back to recency-based");
    return collection
      .find({ userId }, { projection: { embedding: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

/** Get a user's most recent memories, sorted newest first. */
export async function getMemoriesByUser(
  userId: string,
  limit: number = 50
): Promise<MemoryEntry[]> {
  const db = await getDb();
  const collection = db.collection<MemoryEntry>(MEMORIES_COLLECTION);

  return collection
    .find({ userId }, { projection: { embedding: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/** Count total memory entries for a user (used to detect first-time users). */
export async function getMemoryCountByUser(userId: string): Promise<number> {
  const db = await getDb();
  const collection = db.collection<MemoryEntry>(MEMORIES_COLLECTION);
  return collection.countDocuments({ userId });
}

/** Persist a full interaction record including thinking trace and tool calls. */
export async function storeInteraction(interaction: Interaction): Promise<void> {
  const db = await getDb();
  const collection = db.collection<Interaction>(INTERACTIONS_COLLECTION);
  await collection.insertOne(interaction);
}

/** Retrieve a user's recent interactions for context, newest first. */
export async function getRecentInteractions(
  userId: string,
  limit: number = 5
): Promise<Interaction[]> {
  const db = await getDb();
  const collection = db.collection<Interaction>(INTERACTIONS_COLLECTION);

  return collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
