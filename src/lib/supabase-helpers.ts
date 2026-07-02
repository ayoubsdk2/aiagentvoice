/**
 * Small typed helpers around `compliance_settings` reads.
 * Used by guardrail/consent layers to gate behavior on tenant flags.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ComplianceRow = Database["public"]["Tables"]["compliance_settings"]["Row"];
export type ComplianceFlag = {
  [K in keyof ComplianceRow]: ComplianceRow[K] extends boolean ? K : never;
}[keyof ComplianceRow];

/**
 * Read a single boolean compliance flag for a tenant (or the first row if no
 * `customerId` is supplied). Fails-closed: returns `true` on lookup error so
 * defenses stay enabled when the DB is unreachable.
 */
export async function getComplianceSetting(
  flag: ComplianceFlag,
  customerId?: string | null,
): Promise<boolean> {
  let query = supabase.from("compliance_settings").select(flag).limit(1);
  if (customerId) {
    query = supabase
      .from("compliance_settings")
      .select(flag)
      .eq("customer_id", customerId)
      .limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn(`[supabase-helpers] compliance_settings.${flag} lookup failed:`, error.message);
    return true;
  }
  if (!data) return true;
  const value = (data as Record<string, unknown>)[flag];
  return Boolean(value);
}
