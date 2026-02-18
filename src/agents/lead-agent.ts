import { searchLeadsByVector, searchLeadsByText, getLeadById, getAllLeads } from "@/db/leads";
import { generateEmbedding } from "@/lib/embeddings";
import type { Lead } from "@/db/types";

export interface LeadSearchResult {
  leads: Omit<Lead, "embedding">[];
  searchMethod: "vector" | "text" | "all";
  query: string;
}

export async function searchLeads(query: string): Promise<LeadSearchResult> {
  try {
    const embedding = await generateEmbedding(query);
    const leads = await searchLeadsByVector(embedding, 5);

    if (leads.length > 0) {
      return { leads, searchMethod: "vector", query };
    }
  } catch (error) {
    console.warn("Vector search failed, trying text search:", error);
  }

  try {
    const leads = await searchLeadsByText(query, 5);
    if (leads.length > 0) {
      return { leads, searchMethod: "text", query };
    }
  } catch (error) {
    console.warn("Text search failed, returning all leads:", error);
  }

  const leads = await getAllLeads();
  return { leads: leads.slice(0, 5), searchMethod: "all", query };
}

export async function getLeadDetails(leadId: string): Promise<Lead | null> {
  return getLeadById(leadId);
}

export function formatLeadForDisplay(lead: Lead): string {
  return [
    `**${lead.name}** - ${lead.role}`,
    `Company: ${lead.company} (${lead.industry})`,
    `Email: ${lead.email} | Phone: ${lead.phone}`,
    `Pipeline: ${lead.pipeline_stage} | Deal: ${lead.deal_value.toLocaleString("fr-FR")}€`,
    `Location: ${lead.location} | Company size: ${lead.company_size}`,
    `Interests: ${lead.interests.join(", ")}`,
    `Last contact: ${new Date(lead.last_contact).toLocaleDateString("fr-FR")}`,
    `Notes: ${lead.notes}`,
  ].join("\n");
}

export function formatLeadSummary(lead: Lead): string {
  return `${lead.name} (${lead.role} @ ${lead.company}) - ${lead.pipeline_stage} - ${lead.deal_value.toLocaleString("fr-FR")}€`;
}
