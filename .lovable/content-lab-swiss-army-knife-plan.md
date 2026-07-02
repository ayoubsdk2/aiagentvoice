# Content Lab — Swiss Army Knife + 4-Week Strategy Overhaul

**Status:** Awaiting approval. No code will be written until Daniel says "go."
**Owner:** daniel@phaosai.com (sole `phaos_admin`)
**Scope:** Content Lab only. MVP Sandbox, Vapi voice, and all existing security rules are untouched.

---

## 0. Decisions locked in

| Area | Decision |
|---|---|
| AI backend | **Lovable AI Gateway** (`LOVABLE_API_KEY` already provisioned). Gemini Flash for short fields, GPT-5 for blog/long-form. No Anthropic key needed. |
| 4-week progress | **New `content_lab_jobs` table** + frontend polling every 2s. Survives refresh, supports "retry from last step." |
| Surprise Me | **Smart-random with guardrails** — incoherent trait combos (e.g. Punchy/Micro + Deep Dive) are filtered. |
| QA depth | **Playwright E2E** covering Strategic Hub, Single Strike, regenerate, Surprise Me, progress polling — plus Vitest units for trait→prompt mapping and the guardrail logic. |

---

## 1. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    EditPostDialog (StrategicHub)                     │
│                                                                      │
│  ┌─ Title / Category / Status / Scheduled at ────────────────────┐   │
│  │                                                               │   │
│  ┌─ LinkedIn hook ─────────────────────────────────────────────┐ │   │
│  │ [Textarea]                                                  │ │   │
│  │ [AI Regenerate] [🎲 Surprise Me!]                           │ │   │
│  │ [Category ▾] [Voice ▾] [Audience ▾] [Intent ▾]              │ │   │
│  │ [Angle ▾] [Length ▾] [POV ▾]                                │ │   │
│  │ ─ Preview region (only after regen) ─                       │ │   │
│  │   <new copy>          [Apply] [Discard]                     │ │   │
│  └─────────────────────────────────────────────────────────────┘ │   │
│  ┌─ Facebook body ── (same control strip) ────────────────────┐  │   │
│  ┌─ Blog body ────── (same control strip) ────────────────────┐  │   │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ supabase.functions.invoke('content-lab-regenerate', {...})
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Edge Function: content-lab-regenerate                               │
│  - Auth: requires session JWT, owner-only (user_id = auth.uid())     │
│  - Validate body with Zod                                            │
│  - Build trait-aware prompt (see §3)                                 │
│  - Route:                                                            │
│      blog_body  + length≥"Standard"  → openai/gpt-5                  │
│      else                            → google/gemini-3-flash-preview │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              https://ai.gateway.lovable.dev/v1/chat/completions
                              │
                              ▼
                   { text, model, traitsUsed }
                              │
                              ▼
                       UI preview region

══════════════════════════════════════════════════════════════════════════

┌─ StrategicHub: "Generate 4-Week Strategy" ──────────────────────────┐
│  Click → POST content-lab-bulk-generate { mode: "start" }           │
│       → returns { jobId }                                           │
│                                                                     │
│  Modal opens: "Drafting your 4-week strategy…"                      │
│  ┌───────────────────────────────────────────┐                      │
│  │ Week 1 ✓   Week 2 ⏳   Week 3 ·   Week 4 · │                      │
│  │ [████████████░░░░░░░░░░░░] 12/28 posts    │                      │
│  └───────────────────────────────────────────┘                      │
│       ▲                                                             │
│       │  every 2s: GET content-lab-job-status?jobId=…               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  content-lab-bulk-generate (refactored)                              │
│   - "start"  → insert content_lab_jobs row, kick off step 1, return  │
│   - per-week steps run sequentially, each updates progress           │
│   - partial rows land in content_queue as soon as a week finishes    │
│   - on failure: job.status='failed', last_error stored, resumable    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data models

### 2.1 New table: `content_lab_jobs`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | default `auth.uid()`, owner |
| `kind` | text NOT NULL | `'four_week_strategy'` (extensible) |
| `status` | text NOT NULL | `queued` \| `running` \| `succeeded` \| `failed` |
| `total_steps` | int NOT NULL | e.g. 4 (one per week) |
| `completed_steps` | int NOT NULL default 0 | drives the bar |
| `current_step_label` | text | e.g. `"Week 2 — Faith pillar"` |
| `total_posts` | int NOT NULL default 0 | granular counter |
| `posts_created` | int NOT NULL default 0 | granular counter |
| `params` | jsonb default `{}` | { startDate, weeks, faithCadence, … } |
| `result_summary` | jsonb default `{}` | created post IDs, week-by-week recap |
| `last_error` | text | populated on failure |
| `started_at` / `finished_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

**RLS:** owner-only (`user_id = auth.uid()`) for select/insert/update/delete, plus `phaos_admin` full access. Mirrors the `content_queue` pattern that's already working.

**Index:** `(user_id, created_at DESC)` for "show me my last job."

### 2.2 No schema changes to `content_queue`

Regeneration only updates fields the user already owns; existing RLS covers it.

---

## 3. API contracts

### 3.1 `POST /functions/v1/content-lab-regenerate`

**Request body (Zod-validated):**
```ts
{
  fieldType: 'linkedin_hook' | 'facebook_body' | 'blog_body',
  postId?: string,
  postTitle: string,
  postCategory: 'industry' | 'faith' | 'leadership' | 'tactical' | 'case_study' | 'personal' | 'news_trends' | 'product_service' | 'community' | 'security_policy',
  scheduledAt?: string | null,
  originalText: string,
  traits: {
    category: TraitOrAuto, voice: TraitOrAuto, audience: TraitOrAuto,
    intent:   TraitOrAuto, angle: TraitOrAuto, length:   TraitOrAuto, pov: TraitOrAuto,
  },
  channel: 'linkedin' | 'facebook' | 'blog',
  surprise?: boolean
}
```
`TraitOrAuto = { value: string, auto: boolean }` — `value` is one of the literal labels in §4.

**Response:** `{ text: string, model: string, traitsUsed: Record<string, string> }`
**Errors:** 400 (validation), 401 (no JWT), 402 (Lovable AI credits), 429 (rate limit), 500 — all surfaced as toasts.

### 3.2 `POST /functions/v1/content-lab-bulk-generate` (refactored)

- `{ action: 'start', startDate, weeks: 4 }` → `{ jobId }` returned within ~200ms
- Internally enqueued via `EdgeRuntime.waitUntil`
- Per week: generate 7 posts in parallel → insert into `content_queue` → bump counters

### 3.3 `GET /functions/v1/content-lab-job-status?jobId=…`

Returns the `content_lab_jobs` row (owner-checked). Polled by the UI every 2s.

### 3.4 `POST /functions/v1/content-lab-bulk-generate` `{ action: 'retry', jobId }`

Resumes from `completed_steps + 1`. Skips weeks already persisted.

---

## 4. Trait taxonomy — single source of truth

Stored in `src/lib/content-lab/traits.ts`, consumed by both the dropdowns and the prompt builder. Labels match Daniel's spec exactly so they double as prompt-ready strings. (Full arrays in spec — Category × Voice × Audience × Intent × Angle × Length × POV, 10 options each.)

### 4.1 Surprise Me — guardrails (`src/lib/content-lab/surpriseMe.ts`)

```
Channel-aware length:
  linkedin_hook → length ∈ {Punchy/Micro, Headline/Hook Only, Short Narrative}
  facebook_body → length ∉ {Deep Dive}
  blog_body     → length ∈ {Standard, Bullet, Deep Dive, Two-Part, Checklist}

Coherence:
  Step-by-Step Guide → length ∉ {Punchy/Micro, Headline/Hook Only}
  The Parable        → voice ∉ {Technical, Academic}
  Witty + C-Suite    → re-roll voice
  Faith + Skeptics   → voice ∈ {Empathetic, Winsome, Grounded}
  Generate Leads     → pov ∉ {The Skeptic}
```

Up to 5 re-rolls; falls back to a vetted "house combo." Pure deterministic, fully unit-testable.

---

## 5. Prompt construction (edge function)

Shared `buildPrompt(traits, fieldType, channel, originalText, postTitle, postCategory)`:

```
SYSTEM:
You are Phaos AI's Content Lab. Rewrite ONE field of a faith-driven tech/leadership post.
Channel: {channel}. Field: {fieldType}.
Audience: {audience}. Voice: {voice}. POV: {pov}.
Intent: {intent}. Angle: {angle}. Length: {length}.
Pillar: {category}. Original post category: {postCategory}.

Brand rules:
- Ethically serious, technically credible, humble, spiritually grounded.
- Never preachy. Never gimmicky. Hashtags ≤3 on LinkedIn, none on blog.
- LinkedIn hook MUST be ≤180 chars.
- Blog body is markdown.
- If category=Faith, integrate scripture naturally; never quote-mine.

USER:
Post title: {postTitle}
Current {fieldType}:
"""{originalText}"""
Rewrite ONLY the {fieldType}. Output the rewrite directly — no preamble.
```

`Auto` traits are omitted; the model infers from title + original text.

---

## 6. UI changes

### 6.1 New (additive)

```
src/lib/content-lab/
  ├── traits.ts              ← single source of truth (§4)
  ├── surpriseMe.ts          ← guardrail logic (+ tests)
  └── promptBuilder.ts       ← (+ tests)

src/components/content-lab/
  ├── AIControlStrip.tsx     ← 7 dropdowns + 2 buttons
  ├── RegeneratePreview.tsx  ← preview + Apply/Discard
  ├── EditPostDialog.tsx     ← extracted from StrategicHub, mounts 3× AIControlStrip
  └── BulkProgressDialog.tsx ← week-by-week progress modal
```

### 6.2 Edits

- `StrategicHub.tsx` — wire 4-week button to `BulkProgressDialog`, poll status.
- `SingleStrike.tsx` — same `<AIControlStrip>` on each preview field. Free win.

### 6.3 "Auto" state

Each dropdown ships with "Auto" pinned at the top. When `auto=true`, the trait is excluded from the prompt and `traitsUsed` reports `"<auto: inferred>"`.

---

## 7. 4-Week Strategy performance plan

Current pain (confirmed in `content-lab-bulk-generate/index.ts`): all 28 posts generated in one synchronous edge invocation, blocking the request, zero feedback.

Refactor:
1. **Split the work** — per-week function. Each week generates 7 posts, inserts them, increments `completed_steps`.
2. **Background execution** — `EdgeRuntime.waitUntil(runJob(jobId))`; HTTP returns `{ jobId }` in ~200ms.
3. **Concurrent post gen within a week** — `Promise.all` across the 7 daily posts.
4. **Partial visibility** — each week's posts appear in the calendar as soon as that week finishes.
5. **Resume-from-step** — `retry` action reads `completed_steps`, skips done weeks.
6. **Timeouts** — 25s per post, 4min per week. Hard fail with `last_error`; modal surfaces Retry.

Polling cost: 2s × ~3min worst case = ~90 cheap reads.

---

## 8. QA plan

### 8.1 Vitest units

| File | Covers |
|---|---|
| `src/lib/content-lab/__tests__/traits.test.ts` | All 7 trait arrays match spec exactly, no typos |
| `src/lib/content-lab/__tests__/surpriseMe.test.ts` | Each guardrail fires; 1000-iter fuzz never produces forbidden combos |
| `src/lib/content-lab/__tests__/promptBuilder.test.ts` | Auto traits omitted; non-auto interpolated; channel limits respected |
| `supabase/functions/content-lab-regenerate/index_test.ts` | Zod validation, model routing, 401/402/429 paths |

### 8.2 Playwright E2E

| Spec | What it does |
|---|---|
| `content-lab-strategic-hub.spec.ts` | Login → Content Lab → start 4-week → assert progress modal → poll until ≥1 week done → calendar updates |
| `content-lab-edit-post-regen.spec.ts` | Open post → change Voice → Regenerate → Apply → textarea updated |
| `content-lab-surprise-me.spec.ts` | Click Surprise Me → all 7 dropdowns become non-Auto → preview appears |
| `content-lab-single-strike.spec.ts` | Generate single → regen blog with Angle="Parable" → text changes |
| `content-lab-webhooks.spec.ts` | Send Test Ping → toast → `last_test_outcome` row updated |
| `content-lab-bulk-retry.spec.ts` | Mock failure → "Retry from last step" → resumes |

### 8.3 Trait isolation vs blend

Snapshot tests on the prompt builder:
- **Isolation** — change one trait, prompt diff contains exactly that one swapped line.
- **Blend** — change four, all four appear, Auto traits do not.

### 8.4 Failure → corrective action

| Failure | Auto-action |
|---|---|
| Trait label drift | `traits.test.ts` snapshot fails — blocks merge |
| Surprise Me forbidden combo | Fuzz fails with offending seed; fix guardrail |
| Regen 500 | Playwright surfaces toast; CI fails; logs in `edge_function_logs` |
| 4-week job stuck > 5min | UI shows "Still working… [Cancel & Retry]"; `audit_events` row |
| Webhook test ping fails | `content_lab_settings.last_test_error` already captures it |

---

## 9. Files I will create / edit

**New:**
- Migration: `content_lab_jobs` table + RLS
- `src/lib/content-lab/{traits,surpriseMe,promptBuilder}.ts` (+ tests)
- `src/components/content-lab/{AIControlStrip,RegeneratePreview,EditPostDialog,BulkProgressDialog}.tsx`
- `supabase/functions/content-lab-regenerate/index.ts` (+ test)
- `supabase/functions/content-lab-job-status/index.ts`
- `e2e/content-lab-*.spec.ts` (6 files)

**Edited:**
- `src/components/content-lab/StrategicHub.tsx` — mount progress dialog + EditPostDialog
- `src/components/content-lab/SingleStrike.tsx` — mount AIControlStrip on the 3 preview fields
- `supabase/functions/content-lab-bulk-generate/index.ts` — `start`/`step`/`retry`, writes to `content_lab_jobs`

**Untouched:**
- All Vapi / sandbox / voice / auth / non-Content-Lab RLS
- `content_queue` schema and policies
- Webhook payload format from the previous turn

---

## 10. Open questions before I start

Two nice-to-haves — yes/no welcome, otherwise I'll default as noted:

1. **Write a row into `audit_events`** on each regenerate (action `content_lab.regenerate`, metadata = traits used)? **Default: yes.**
2. **Progress modal: show real post titles as they're drafted, or just "Week N of 4"?** **Default: titles.**

---

**Reply "go" (or "go, but skip X") and I'll start with the migration → traits module → edge function → UI → E2E, in that order.**
