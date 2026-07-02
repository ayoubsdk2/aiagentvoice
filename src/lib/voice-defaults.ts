// Platform voice agent IDs. The full platform standardizes on Retell AI.
//
// LIVE_RETELL_AGENT_ID — baseline agent every new tenant clones during
// provisioning. Used by provision-worker.
// SANDBOX_RETELL_AGENT_ID — the standalone agent powering the public
// developer sandbox (independent from production tenants).
export const LIVE_RETELL_AGENT_ID = "agent_acda13b2c5b4310a22fb57a44b";
export const SANDBOX_RETELL_AGENT_ID = "agent_2370c261491bd449681dfe559c";

// Back-compat exports — referenced by older Sandbox code paths during the
// platform cutover. These remain pointing at the sandbox agent so any
// stragglers continue to work, but new code should import the Retell
// constants above.
export const DEFAULT_VOICE_ASSISTANT_ID = SANDBOX_RETELL_AGENT_ID;
export const DEFAULT_VOICE_PUBLIC_KEY = ""; // Retell uses ephemeral access tokens; no public key.
