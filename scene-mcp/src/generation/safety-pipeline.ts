import type { OpenAiClient } from "./openai-client.js";

export async function generateCopyWithCap(
  client: OpenAiClient,
  prompt: string,
  characterLimit?: number,
  tone?: string[],
): Promise<{ text: string; attempts: number }> {
  const maxAttempts = 3;
  let attempts = 0;
  let text = prompt;

  while (attempts < maxAttempts) {
    attempts += 1;
    const result = await client.generateCopy(prompt, { characterLimit, tone });
    text = result.text;
    if (!characterLimit || text.length <= characterLimit) {
      return { text, attempts };
    }
  }

  if (characterLimit) {
    text = text.slice(0, characterLimit);
  }
  return { text, attempts };
}

export async function runAssetModeration(
  client: OpenAiClient,
  assetType: "copy" | "image" | "background",
  payload: string,
): Promise<boolean> {
  if (assetType === "copy") {
    return client.moderateText(payload);
  }
  return client.moderateImage(payload);
}

export async function runBrandLegalCheck(
  _tenantId: string,
  _assetType: string,
): Promise<boolean> {
  return true;
}
