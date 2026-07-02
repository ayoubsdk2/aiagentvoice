/**
 * Password policy + strength scoring for the signup flow.
 * Pure functions, no logging of plaintext or scoring details.
 */

export interface PasswordRules {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export interface PasswordStrength {
  /** 0..4 — used to drive the meter UI. */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  /** Tailwind/HSL semantic token class for the meter fill. */
  toneClass: string;
}

const SPECIAL = /[^A-Za-z0-9]/;

export function evaluateRules(password: string): PasswordRules {
  return {
    minLength: password.length >= 10,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: SPECIAL.test(password),
  };
}

export function meetsPolicy(password: string): boolean {
  const r = evaluateRules(password);
  return r.minLength && r.hasUppercase && r.hasLowercase && r.hasNumber && r.hasSpecial;
}

export function scorePassword(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "Too weak", toneClass: "bg-destructive" };
  }
  const r = evaluateRules(password);
  let s = 0;
  if (r.minLength) s++;
  if (r.hasUppercase || r.hasLowercase) s++; // any letter case counts
  if (r.hasNumber) s++;
  if (r.hasSpecial) s++;

  // Deterministic mapping aligned with the meter's 4 visual segments:
  // 1/4 → red, 2/4 → orange, 3/4 → yellow, 4/4 → green.
  const map: Record<number, PasswordStrength> = {
    0: { score: 0, label: "Too weak", toneClass: "bg-destructive" },
    1: { score: 1, label: "Weak", toneClass: "bg-destructive" },
    2: { score: 2, label: "Fair", toneClass: "bg-[hsl(25_95%_55%)]" },
    3: { score: 3, label: "Strong", toneClass: "bg-[hsl(48_96%_53%)]" },
    4: { score: 4, label: "Very strong", toneClass: "bg-[hsl(var(--success))]" },
  };
  return map[s as 0 | 1 | 2 | 3 | 4];
}
