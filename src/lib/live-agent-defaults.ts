// Production base Retell agents used when a LIVE account is provisioned.
// Every new customer's agent is cloned from one of these two, based on the
// industry chosen for the line at provisioning time.
//
// - Document Solutions → the specialized office-imaging / MPS agent.
// - Everything else (41 other industries) → the generic multi-industry agent.
export const DOC_SOLUTIONS_BASE_AGENT_ID = "agent_33d6c5549eb8ed8203fd5b6537";
export const GENERIC_BASE_AGENT_ID       = "agent_281c022afc5fd87515a3a7956a";

export function resolveBaseAgentId(industryId?: string | null): string {
  return industryId === "document-solutions"
    ? DOC_SOLUTIONS_BASE_AGENT_ID
    : GENERIC_BASE_AGENT_ID;
}
