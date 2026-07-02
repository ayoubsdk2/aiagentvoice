# Content Lab — End-to-End QA Checklist

Live runner: **`/admin/qa`** (Phaos admin only). LLM judge: `qa-judge-output` edge function (Gemini 3 Flash Preview).

## 1. Trait Isolation (7 tests)

For each trait, only that trait is set; others = `Auto`. Judge scores 1-5 per trait + overall pass/fail (≥3.5 average).

| Test | Expected signature |
|---|---|
| Voice = Technical | Adds CPP/MIF/SLA/ppm jargon, measurable claims; theology preserved |
| Audience = C-Suite | ROI/risk/strategy framing; no low-level mechanics |
| Category = Faith | Scripture (NIV) + Jesus reference; ecumenical |
| Intent = Generate Leads | Concrete CTA (DM, demo, comment) |
| Angle = Data-Driven | Specific numbers / percentages / estimates |
| Length = Punchy/Micro | ≤2 sentences, sharp opener |
| POV = 2nd Person | Heavy "you/your"; no "we/our" subject |

**Corrective action**: If a trait fails consistently, check `TRAIT_PROMPT_KEYS` mapping in `traits.ts` and the system prompt in `content-lab-regenerate/index.ts`.

## 2. Blended (3 tests)

| Combo | Expected |
|---|---|
| Tactical / Technical / IT Mgrs / Data-Driven / Standard | Step-by-step, infra vocab, numbered |
| Faith / Empathetic / Faith Leaders / Personal Reflection / Short Narrative / 1st Person | Warm "I" story, one NIV verse |
| Product / Authoritative / C-Suite / Generate Leads / Problem-Solution / Punchy | <180 chars, hard CTA, exec voice |

## 3. Surprise Me Diversity

Roll 5 combos, dashboard computes diversity = avg(unique values per trait / 5). **Pass threshold: >60%**.

**Corrective action**: If diversity is low, increase `maxRerolls` in `surpriseMe.ts` or expand `categoryRules.prefer` lists in `surprise-rules.json`.

## 4. 4-Week Strategy

- **Happy path**: dashboard → "Start happy-path job" → progress bar reaches 4/4, status `completed`.
- **Failure injection**: set "Fail at week" = 3 → "Start failure-injection job" → job marks `failed` at week 3; weeks 1-2 inserted; "Retry from last successful step" in `StrategyProgressDialog` resumes from week 3.

The `fail_at_step` flag is admin-gated (email allowlist in `strategy-job-start`) and propagates through the self-chaining worker.

**Corrective action**: If realtime updates lag, fall back to the polling path via `strategy-job-progress` in `StrategyProgressDialog`.

## 5. Webhooks & Single Strike

- Webhook URL → "Ping" → expect 2xx within ~2s.
- Single Strike: manually generate one post in `/admin/content-lab` and confirm trait controls render and Apply works.
- Strategic Hub: confirm 4-week button still launches `strategy-job-start`.

## 6. LinkedIn Live Post

1. **Dry-run** first (default checkbox on) — confirms pipeline, no API call.
2. **Live post**: requires secrets `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_PERSON_URN` (from `/v2/userinfo`).
3. Edge function retries up to 7× on transient HTTP (408/425/429/5xx) with exponential backoff (500ms → 15s cap).
4. Success returns `post_id` + clickable LinkedIn URL.

**Corrective actions on failure**:
- 401 → access token expired (60-day lifetime). Re-run OAuth.
- 403 → missing `w_member_social` scope on the LinkedIn app.
- 422 → text exceeds 3000 chars or malformed payload.
- All-attempts fail → check `linkedin-post` edge function logs.

## Adding new tests

Edit `src/lib/content-lab/qa-specs.ts` — add a `QATestSpec` to `TRAIT_ISOLATION_TESTS` or `BLENDED_TESTS`. The dashboard picks them up automatically.
