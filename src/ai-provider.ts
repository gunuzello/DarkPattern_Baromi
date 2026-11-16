export function extractAiOutputText(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (Array.isArray(record.output)) {
    return record.output.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content.flatMap((entry) => entry && typeof entry === "object" && typeof (entry as { text?: unknown }).text === "string" ? [(entry as { text: string }).text] : []) : [];
    }).join("\n");
  }
  if (Array.isArray(record.candidates)) {
    const candidate = record.candidates[0] as { content?: { parts?: { text?: string }[] } } | undefined;
    return candidate?.content?.parts?.map(({ text }) => text ?? "").join("") ?? "";
  }
  return "";
}

export function extractAiTokenUsage(body: unknown) {
  if (!body || typeof body !== "object") return { inputTokens: 0, outputTokens: 0 };
  const record = body as { usage?: { input_tokens?: number; output_tokens?: number }; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
  return {
    inputTokens: record.usage?.input_tokens ?? record.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: record.usage?.output_tokens ?? ((record.usageMetadata?.candidatesTokenCount ?? 0) + (record.usageMetadata?.thoughtsTokenCount ?? 0)),
  };
}
