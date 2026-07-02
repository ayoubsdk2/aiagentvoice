export type SchedulerPlatform = "linkedin" | "facebook" | "blog";
export type SchedulerCategory = "A" | "B" | "C";
export type SchedulerMediaType = "text" | "image" | "video" | "link";

export type SlotCode =
  | "blog_0600_long"
  | "blog_0600_short"
  | "linkedin_0800_a"
  | "linkedin_1600_b"
  | "facebook_0900_a"
  | "facebook_1300_b"
  | "facebook_1700_c"
  | "facebook_sunday_0900_scripture";

export interface SchedulerSlot {
  code: SlotCode;
  platform: SchedulerPlatform;
  category: SchedulerCategory;
  localDate: string;
  scheduledAtIso: string;
  weekday: number;
  timeLabel: string;
  requiresScripture?: boolean;
  requiresRichMedia?: boolean;
  blogWordTarget?: "long" | "short";
}

export interface QueueLikeRow {
  id?: string;
  scheduled_at: string | null;
  status?: string | null;
  category?: string | null;
  title?: string | null;
  linkedin_hook?: string | null;
  facebook_body?: string | null;
  blog_body?: string | null;
  image_url?: string | null;
  platform_targets?: Record<string, unknown> | null;
  seo_metadata?: Record<string, unknown> | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  slot: SchedulerSlot | null;
  issues: ValidationIssue[];
}

export const EASTERN_TIME_ZONE = "America/New_York";

const etFormatter = new Intl.DateTimeFormat("en-US", {
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

const LINKEDIN_GAP_MS = 8 * 60 * 60 * 1000;
const FACEBOOK_GAP_MS = 4 * 60 * 60 * 1000;
const compellingHookPattern = /(^\d)|(^[^a-zA-Z0-9\s])|\?|!|:|\b(why|how|what if|most|stop|start|the truth|here's|your)\b/i;
const versePattern = /\b(?:[1-3]\s)?[A-Z][a-z]+\s\d+:\d+\b/;
const jesusPattern = /\b(Jesus|Judah|Messiah)\b/i;

export function getEasternParts(date: Date) {
  const parts = Object.fromEntries(etFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday] ?? 0,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function easternDateKey(date: Date) {
  const p = getEasternParts(date);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function easternDateFromNowPlusDays(days: number) {
  const now = new Date();
  const et = getEasternParts(now);
  const seed = zonedTimeToUtc(et.year, et.month, et.day, 0, 0, 0, EASTERN_TIME_ZONE);
  seed.setUTCDate(seed.getUTCDate() + days);
  return easternDateKey(seed);
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone = EASTERN_TIME_ZONE,
) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(guess).map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = target - asUtc;
    if (diff === 0) return guess;
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

export function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return { year, month, day };
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const { year, month, day } = parseLocalDateKey(dateKey);
  const seed = zonedTimeToUtc(year, month, day, 0, 0, 0, EASTERN_TIME_ZONE);
  seed.setUTCDate(seed.getUTCDate() + days);
  return easternDateKey(seed);
}

export function getWeekSlots(windowStartDateKey: string): SchedulerSlot[] {
  const slots: SchedulerSlot[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const localDate = addDaysToDateKey(windowStartDateKey, offset);
    const { year, month, day } = parseLocalDateKey(localDate);
    const weekday = getEasternParts(zonedTimeToUtc(year, month, day, 12, 0, 0, EASTERN_TIME_ZONE)).weekday;

    const pushSlot = (
      code: SlotCode,
      platform: SchedulerPlatform,
      category: SchedulerCategory,
      hour: number,
      minute: number,
      extra: Partial<SchedulerSlot> = {},
    ) => {
      const scheduledAtIso = zonedTimeToUtc(year, month, day, hour, minute, 0, EASTERN_TIME_ZONE).toISOString();
      slots.push({
        code,
        platform,
        category,
        localDate,
        scheduledAtIso,
        weekday,
        timeLabel: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
        ...extra,
      });
    };

    if (weekday >= 1 && weekday <= 5) {
      const blogCode: SlotCode = weekday === 1 || weekday === 3 || weekday === 5 ? "blog_0600_long" : "blog_0600_short";
      pushSlot(blogCode, "blog", weekday === 2 ? "A" : weekday === 4 ? "C" : "B", 6, 0, {
        blogWordTarget: blogCode === "blog_0600_long" ? "long" : "short",
      });
      pushSlot("linkedin_0800_a", "linkedin", "A", 8, 0);
      pushSlot("facebook_0900_a", "facebook", "A", 9, 0);
      pushSlot("facebook_1300_b", "facebook", "B", 13, 0);
      pushSlot("linkedin_1600_b", "linkedin", "B", 16, 0);
      pushSlot("facebook_1700_c", "facebook", "C", 17, 0, { requiresRichMedia: true });
    }

    if (weekday === 0) {
      pushSlot("facebook_sunday_0900_scripture", "facebook", "A", 9, 0, {
        requiresScripture: true,
      });
    }
  }

  return slots.sort((a, b) => new Date(a.scheduledAtIso).getTime() - new Date(b.scheduledAtIso).getTime());
}

export function slotFromScheduledAt(scheduledAtIso: string): SchedulerSlot | null {
  const scheduled = new Date(scheduledAtIso);
  const et = getEasternParts(scheduled);
  const localDate = `${String(et.year).padStart(4, "0")}-${String(et.month).padStart(2, "0")}-${String(et.day).padStart(2, "0")}`;

  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 6 && et.minute === 0) {
    return {
      code: et.weekday === 1 || et.weekday === 3 || et.weekday === 5 ? "blog_0600_long" : "blog_0600_short",
      platform: "blog",
      category: et.weekday === 2 ? "A" : et.weekday === 4 ? "C" : "B",
      localDate,
      scheduledAtIso,
      weekday: et.weekday,
      timeLabel: "06:00:00",
      blogWordTarget: et.weekday === 1 || et.weekday === 3 || et.weekday === 5 ? "long" : "short",
    };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 8 && et.minute === 0) {
    return { code: "linkedin_0800_a", platform: "linkedin", category: "A", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "08:00:00" };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 9 && et.minute === 0) {
    return { code: "facebook_0900_a", platform: "facebook", category: "A", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "09:00:00" };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 13 && et.minute === 0) {
    return { code: "facebook_1300_b", platform: "facebook", category: "B", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "13:00:00" };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 16 && et.minute === 0) {
    return { code: "linkedin_1600_b", platform: "linkedin", category: "B", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "16:00:00" };
  }
  if (et.weekday >= 1 && et.weekday <= 5 && et.hour === 17 && et.minute === 0) {
    return { code: "facebook_1700_c", platform: "facebook", category: "C", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "17:00:00", requiresRichMedia: true };
  }
  if (et.weekday === 0 && et.hour === 9 && et.minute === 0) {
    return { code: "facebook_sunday_0900_scripture", platform: "facebook", category: "A", localDate, scheduledAtIso, weekday: et.weekday, timeLabel: "09:00:00", requiresScripture: true };
  }
  return null;
}

export function getPlatformTarget(row: QueueLikeRow): SchedulerPlatform | null {
  const platform = row.platform_targets?.platform;
  if (platform === "linkedin" || platform === "facebook" || platform === "blog") return platform;
  return null;
}

export function getMediaType(row: QueueLikeRow): SchedulerMediaType {
  const explicit = row.platform_targets?.media_type;
  if (explicit === "text" || explicit === "image" || explicit === "video" || explicit === "link") return explicit;
  return row.image_url ? "image" : getPlatformTarget(row) === "blog" ? "link" : "text";
}

function countHashtags(text: string) {
  const matches = text.match(/#[A-Za-z0-9_]+/g);
  return matches ? matches.length : 0;
}

function isCompellingHook(text: string) {
  const first210 = text.slice(0, 210).trim();
  return first210.length >= 20 && compellingHookPattern.test(first210);
}

export function buildHumanLoopComments(title: string, platform: SchedulerPlatform) {
  const intros = [
    "Sharp point",
    "Strong takeaway",
    "This hits a real ops nerve",
    "Well said",
    "That’s the conversation leaders should be having",
  ];
  return Array.from({ length: 5 }, (_, index) => {
    const intro = intros[index % intros.length];
    return `${intro} on ${title.toLowerCase()}. We keep seeing teams underestimate the downstream cost of weak process discipline. Curious how others are handling it on ${platform}.`;
  });
}

function mergeIssues(issues: ValidationIssue[], code: string, message: string) {
  issues.push({ code, message });
}

export function validateScheduledPost(row: QueueLikeRow, existingRows: QueueLikeRow[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!row.scheduled_at) {
    mergeIssues(issues, "missing_schedule", "Post must have a scheduled time.");
    return { ok: false, slot: null, issues };
  }

  const slot = slotFromScheduledAt(row.scheduled_at);
  if (!slot) {
    mergeIssues(issues, "invalid_slot", "Time does not match an allowed Eastern Time slot.");
    return { ok: false, slot: null, issues };
  }

  const platform = getPlatformTarget(row);
  if (platform && platform !== slot.platform) {
    mergeIssues(issues, "platform_slot_mismatch", `This row targets ${platform}, but the selected slot is for ${slot.platform}.`);
  }

  const normalizedCategory = (row.category ?? "").toUpperCase();
  if (normalizedCategory && normalizedCategory !== slot.category) {
    mergeIssues(issues, "category_lock", `Category ${normalizedCategory} cannot be used in the ${slot.code} slot.`);
  }

  if (slot.platform === "linkedin") {
    const text = row.linkedin_hook ?? "";
    if (!text.trim()) mergeIssues(issues, "missing_linkedin_copy", "LinkedIn copy is required.");
    if (text.length > 3000) mergeIssues(issues, "linkedin_too_long", "LinkedIn copy exceeds 3,000 characters.");
    const tagCount = countHashtags(text);
    if (slot.category === "A" && tagCount !== 3) {
      mergeIssues(issues, "linkedin_tags_a", "LinkedIn Category A posts must include exactly 3 hashtags.");
    }
    if (slot.category === "B" && tagCount !== 5 && !/case study/i.test(text)) {
      mergeIssues(issues, "linkedin_tags_b", "LinkedIn educational posts must include exactly 5 hashtags.");
    }
    if (tagCount > 5) {
      mergeIssues(issues, "linkedin_tags_max", "LinkedIn posts cannot exceed 5 hashtags.");
    }
    if (!isCompellingHook(text)) {
      mergeIssues(issues, "linkedin_hook", "The first 210 characters need a stronger hook.");
    }
    if (slot.code === "linkedin_0800_a" && normalizedCategory === "C") {
      mergeIssues(issues, "linkedin_cat_c", "Category C content can never be scheduled in LinkedIn 08:00.");
    }
  }

  if (slot.platform === "facebook") {
    const text = row.facebook_body ?? "";
    if (!text.trim()) mergeIssues(issues, "missing_facebook_copy", "Facebook copy is required.");
    if (text.length > 5000) mergeIssues(issues, "facebook_too_long", "Facebook copy exceeds 5,000 characters.");
    const tagCount = countHashtags(text);
    if (tagCount > 3) mergeIssues(issues, "facebook_tags_max", "Facebook posts cannot exceed 3 hashtags.");
    if ((slot.category === "A" || slot.category === "C") && (tagCount < 2 || tagCount > 3)) {
      mergeIssues(issues, "facebook_tags", "Faith and witty Facebook posts must include 2–3 hashtags.");
    }
    if (slot.code === "facebook_1700_c" && normalizedCategory === "A") {
      mergeIssues(issues, "facebook_cat_a_1700", "Category A content cannot be placed in Facebook 17:00.");
    }
    if (slot.requiresRichMedia) {
      const mediaType = getMediaType(row);
      const width = Number(row.platform_targets?.media_width ?? row.seo_metadata?.media_width ?? 0);
      if (!(mediaType === "image" || mediaType === "video")) {
        mergeIssues(issues, "facebook_1700_media", "Facebook 17:00 requires an image or video asset.");
      }
      if (mediaType === "image" && width > 0 && width < 1080) {
        mergeIssues(issues, "facebook_1700_width", "Facebook 17:00 images must be at least 1080px wide.");
      }
    }
    if (slot.requiresScripture) {
      if (!jesusPattern.test(text) || !versePattern.test(text)) {
        mergeIssues(issues, "facebook_sunday_scripture", "Sunday 09:00 Facebook posts must mention Jesus/Judah/Messiah and include a Bible verse reference.");
      }
    }
  }

  if (slot.platform === "blog") {
    const text = row.blog_body ?? "";
    if (!text.trim()) mergeIssues(issues, "missing_blog_copy", "Blog content is required.");
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (slot.blogWordTarget === "long" && wordCount < 1200) {
      mergeIssues(issues, "blog_long_short", "Monday/Wednesday/Friday blog posts must be at least 1,200 words.");
    }
    if (slot.blogWordTarget === "short" && (wordCount < 400 || wordCount > 600)) {
      mergeIssues(issues, "blog_short_range", "Tuesday/Thursday blog posts must be 400–600 words.");
    }
  }

  const currentTime = new Date(row.scheduled_at).getTime();
  const samePlatformRows = existingRows
    .filter((candidate) => candidate.id !== row.id && candidate.scheduled_at && getPlatformTarget(candidate) === slot.platform)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  for (const other of samePlatformRows) {
    const otherTime = new Date(other.scheduled_at!).getTime();
    const diff = Math.abs(currentTime - otherTime);
    if (slot.platform === "linkedin" && diff < LINKEDIN_GAP_MS) {
      mergeIssues(issues, "linkedin_gap", "LinkedIn posts must remain at least 8 hours apart.");
      break;
    }
    if (slot.platform === "facebook" && diff < FACEBOOK_GAP_MS) {
      mergeIssues(issues, "facebook_gap", "Facebook posts must remain at least 4 hours apart.");
      break;
    }
  }

  const previousRow = samePlatformRows.filter((candidate) => new Date(candidate.scheduled_at!).getTime() < currentTime).pop();
  if (previousRow && getMediaType(previousRow) === getMediaType(row)) {
    mergeIssues(issues, "media_rotation", "Media type cannot repeat consecutively on the same platform.");
  }

  return { ok: issues.length === 0, slot, issues };
}

export function computeBlendedValueRatio(rows: QueueLikeRow[]) {
  if (rows.length === 0) return 1;
  const blended = rows.filter((row) => {
    const category = (row.category ?? "").toUpperCase();
    return category === "A" || category === "B" || category === "C";
  }).length;
  return blended / rows.length;
}
