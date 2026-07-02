/**
 * Client-side helper that POSTs a regeneration request to the
 * `content-lab-regenerate` edge function.
 *
 * Translates the UI-side trait keys into the prompt-side keys the
 * edge function expects, leaving Auto values as the literal "Auto"
 * string so the LLM can infer them.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  TRAIT_AUTO,
  TRAIT_KEYS,
  TRAIT_PROMPT_KEYS,
  type TraitKey,
  type TraitState,
} from "./traits";

export type RegenFieldType = "linkedin_hook" | "facebook_body" | "blog_markdown";
export type RegenChannel = "linkedin" | "facebook" | "blog";

export interface GenerateStyledCopyArgs {
  fieldType: RegenFieldType;
  postId?: string | null;
  postTitle: string;
  postCategory: string;
  originalText: string;
  traits: TraitState;
  channel: RegenChannel;
  surprise?: boolean;
}

export interface GenerateStyledCopyResult {
  text: string;
  model: string;
  traitsUsed: Record<string, string>;
  durationMs: number;
}

function toPromptTraits(traits: TraitState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of TRAIT_KEYS as TraitKey[]) {
    out[TRAIT_PROMPT_KEYS[k]] = traits[k] || TRAIT_AUTO;
  }
  return out;
}

export async function generateStyledCopy(
  args: GenerateStyledCopyArgs,
): Promise<GenerateStyledCopyResult> {
  const payload = {
    fieldType: args.fieldType,
    postId: args.postId ?? null,
    postTitle: args.postTitle,
    postCategory: args.postCategory,
    originalText: args.originalText,
    traits: toPromptTraits(args.traits),
    channel: args.channel,
    surprise: !!args.surprise,
  };

  const { data, error } = await supabase.functions.invoke("content-lab-regenerate", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "Regeneration failed");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Empty response from regeneration service");
  }
  if ((data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  const text = (data as { text?: string }).text;
  if (!text) {
    throw new Error("Regeneration returned no text");
  }
  return {
    text,
    model: (data as { model?: string }).model ?? "unknown",
    traitsUsed: (data as { traitsUsed?: Record<string, string> }).traitsUsed ?? {},
    durationMs: (data as { durationMs?: number }).durationMs ?? 0,
  };
}
