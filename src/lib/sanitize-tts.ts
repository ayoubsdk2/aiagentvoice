/**
 * Strips Markdown formatting and technical artifacts from text
 * before sending to the TTS engine. The UI still displays rich Markdown.
 */
export function cleanTextForTTS(text: string): string {
  return text
    // Remove headers (keep newline so it can be turned into a sentence break)
    .replace(/^#{1,6}\s*/gm, "")
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, "$1")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove blockquotes
    .replace(/>\s*/g, "")
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove horizontal rules
    .replace(/---+/g, "")
    // Remove bullet points
    .replace(/^[\s]*[-*+]\s+/gm, "")
    // Remove numbered lists prefix
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Any newline (single or multiple) becomes a sentence break for natural TTS pacing
    .replace(/\n+/g, ". ")
    // Collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}
