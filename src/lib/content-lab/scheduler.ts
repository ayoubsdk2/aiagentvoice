export type SchedulerPlatform = "linkedin" | "facebook" | "blog";
export type SchedulerCategory = "A" | "B" | "C";
export type SchedulerMediaType = "text" | "image" | "video" | "link";

export const EASTERN_TIME_ZONE = "America/New_York";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  weekday: "short",
});

const weekdayMap: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
};

export type SchedulerSlotCode =
  | "blog_0600_long"
  | "blog_0600_short"
  | "linkedin_0800_a"
  | "linkedin_1600_b"
  | "facebook_0900_a"
  | "facebook_1300_b"
  | "facebook_1700_c"
  | "facebook_sunday_0900_scripture";

export interface SchedulerSlotSummary {
  code: SchedulerSlotCode;
  platform: SchedulerPlatform;
  category: SchedulerCategory;
  timeLabel: string;
  localDate: string;
}

export interface QueuePresentationRow {
  id: string;
  scheduled_at: string | null;
  category: string;
  status: string;
  title: string;
  linkedin_hook: string | null;
  facebook_body: string | null;
  blog_body: string | null;
  image_url?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
  published_at?: string | null;
  platform_targets?: Record<string, unknown> | null;
  seo_metadata?: Record<string, unknown> | null;
}

export function getEasternParts(date: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

export function getPlatformLabel(platform: unknown) {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "facebook") return "Facebook";
  if (platform === "blog") return "Blog";
  return "Unassigned";
}

export function getPlatformTarget(row: QueuePresentationRow): SchedulerPlatform | null {
  const platform = row.platform_targets?.platform;
  if (platform === "linkedin" || platform === "facebook" || platform === "blog") return platform;
  return null;
}

export function getMediaType(row: QueuePresentationRow): SchedulerMediaType {
  const mediaType = row.platform_targets?.media_type;
  if (mediaType === "text" || mediaType === "image" || mediaType === "video" || mediaType === "link") {
    return mediaType;
  }
  return row.image_url ? "image" : getPlatformTarget(row) === "blog" ? "link" : "text";
}

export function getSlotSummary(scheduledAtIso: string | null): SchedulerSlotSummary | null {
  if (!scheduledAtIso) return null;
  const date = new Date(scheduledAtIso);
  const et = getEasternParts(date);
  const localDate = `${String(et.year).padStart(4, "0")}-${String(et.month).padStart(2, "0")}-${String(et.day).padStart(2, "0")}`;
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 6 && et.minute === 0) {
    return { code: et.weekday === 1 || et.weekday === 3 || et.weekday === 5 ? "blog_0600_long" : "blog_0600_short", platform: "blog", category: et.weekday === 2 ? "A" : et.weekday === 4 ? "C" : "B", timeLabel: "06:00 ET", localDate };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 8 && et.minute === 0) {
    return { code: "linkedin_0800_a", platform: "linkedin", category: "A", timeLabel: "08:00 ET", localDate };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 9 && et.minute === 0) {
    return { code: "facebook_0900_a", platform: "facebook", category: "A", timeLabel: "09:00 ET", localDate };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 13 && et.minute === 0) {
    return { code: "facebook_1300_b", platform: "facebook", category: "B", timeLabel: "13:00 ET", localDate };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 16 && et.minute === 0) {
    return { code: "linkedin_1600_b", platform: "linkedin", category: "B", timeLabel: "16:00 ET", localDate };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 17 && et.minute === 0) {
    return { code: "facebook_1700_c", platform: "facebook", category: "C", timeLabel: "17:00 ET", localDate };
  }
  if (et.weekday === 0 && et.hour === 9 && et.minute === 0) {
    return { code: "facebook_sunday_0900_scripture", platform: "facebook", category: "A", timeLabel: "Sun 09:00 ET", localDate };
  }
  return null;
}

export type StatusTone = "published" | "failed" | "scheduled" | "generated";

export function getStatusTone(row: QueuePresentationRow): StatusTone {
  if (row.published_at || row.status === "published") {
    return "published";
  }
  if (row.last_error) {
    return "failed";
  }
  if (row.status === "scheduled") {
    return "scheduled";
  }
  return "generated";
}

/**
 * Tailwind classes for the calendar pill. Uses semantic tokens only —
 * `primary` (brand purple) for scheduled, `accent` for generated drafts,
 * `destructive` for failures, and a green-tinted variant of `primary` for
 * published. We don't introduce new hex values so the design system stays consistent.
 */
export function getStatusClasses(tone: StatusTone) {
  switch (tone) {
    case "published":
      return "bg-primary/25 border-primary/60 text-primary-foreground/90 hover:bg-primary/35";
    case "failed":
      return "bg-destructive/15 border-destructive/60 text-destructive hover:bg-destructive/25";
    case "scheduled":
      return "bg-primary/15 border-primary/50 text-foreground hover:bg-primary/25";
    case "generated":
    default:
      return "bg-muted border-border text-muted-foreground hover:bg-muted/80";
  }
}

/**
 * Lightweight client-side validation for a single row, mirroring the rules in
 * supabase/functions/_shared/content-scheduler.ts. We re-implement here (instead
 * of importing the Deno file) to keep the bundle clean and dependency-free.
 *
 * Returns the list of human-readable rule failures so the UI can show exactly
 * which non-negotiable rule is blocking a publish.
 */
export interface SlotValidationIssue {
  code: string;
  message: string;
}

const LINKEDIN_GAP_MS = 8 * 60 * 60 * 1000;
const FACEBOOK_GAP_MS = 4 * 60 * 60 * 1000;
const versePattern = /\b(?:[1-3]\s)?[A-Z][a-z]+\s\d+:\d+\b/;
const jesusPattern = /\b(Jesus|Judah|Messiah)\b/i;

export function validateRowForPublish(
  row: QueuePresentationRow,
  allRows: QueuePresentationRow[],
): SlotValidationIssue[] {
  const issues: SlotValidationIssue[] = [];
  if (!row.scheduled_at) {
    issues.push({ code: "missing_schedule", message: "Post has no scheduled_at time." });
    return issues;
  }
  const slot = getSlotSummary(row.scheduled_at);
  if (!slot) {
    issues.push({
      code: "invalid_slot",
      message: "Scheduled time is not one of the approved Eastern Time slots (LI 08/16, FB 09/13/17, Sun FB 09, Blog 06).",
    });
    return issues;
  }
  const platform = getPlatformTarget(row) ?? slot.platform;

  if (platform === "linkedin") {
    const text = row.linkedin_hook ?? "";
    if (!text.trim()) issues.push({ code: "missing_linkedin_copy", message: "LinkedIn copy is required." });
    if (text.length > 3000) issues.push({ code: "linkedin_too_long", message: "LinkedIn copy exceeds the 3,000-character limit." });
    if (slot.code === "linkedin_0800_a" && (row.category ?? "").toUpperCase() === "C") {
      issues.push({ code: "linkedin_cat_c", message: "Category C cannot be scheduled in the LinkedIn 08:00 slot." });
    }
  }
  if (platform === "facebook") {
    const text = row.facebook_body ?? "";
    if (!text.trim()) issues.push({ code: "missing_facebook_copy", message: "Facebook copy is required." });
    if (text.length > 5000) issues.push({ code: "facebook_too_long", message: "Facebook copy exceeds the 5,000-character limit." });
    if (slot.code === "facebook_1700_c") {
      const mediaType = getMediaType(row);
      if (!(mediaType === "image" || mediaType === "video")) {
        issues.push({ code: "facebook_1700_media", message: "Facebook 17:00 slot requires an image or video asset." });
      }
    }
    if (slot.code === "facebook_sunday_0900_scripture") {
      if (!jesusPattern.test(text) || !versePattern.test(text)) {
        issues.push({
          code: "facebook_sunday_scripture",
          message: "Sunday 09:00 Facebook posts MUST mention Jesus/Judah/Messiah AND include a Bible verse reference (e.g., John 14:6).",
        });
      }
    }
  }

  // Gap rules — same platform, same row excluded.
  const current = new Date(row.scheduled_at).getTime();
  for (const other of allRows) {
    if (!other.scheduled_at || other.id === row.id) continue;
    const otherPlatform = getPlatformTarget(other);
    if (otherPlatform !== platform) continue;
    const diff = Math.abs(current - new Date(other.scheduled_at).getTime());
    if (platform === "linkedin" && diff < LINKEDIN_GAP_MS) {
      issues.push({ code: "linkedin_gap", message: "LinkedIn posts must remain at least 8 hours apart." });
      break;
    }
    if (platform === "facebook" && diff < FACEBOOK_GAP_MS) {
      issues.push({ code: "facebook_gap", message: "Facebook posts must remain at least 4 hours apart." });
      break;
    }
  }

  return issues;
}

export function getStatusLabel(row: QueuePresentationRow) {
  const tone = getStatusTone(row);
  if (tone === "published") return "Posted";
  if (tone === "failed") return "Needs attention";
  if (tone === "scheduled") return "Scheduled";
  return "Generated";
}

export function getDeliveryLink(row: QueuePresentationRow) {
  const delivery = row.seo_metadata?.delivery;
  if (delivery && typeof delivery === "object" && typeof (delivery as Record<string, unknown>).post_url === "string") {
    return (delivery as Record<string, unknown>).post_url as string;
  }
  return null;
}

export function getHumanLoopComments(row: QueuePresentationRow) {
  const comments = row.seo_metadata?.human_loop_comments;
  return Array.isArray(comments) ? comments.filter((value): value is string => typeof value === "string") : [];
}
