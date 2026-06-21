export interface CopyGenerationResult {
  text: string;
  attempts: number;
}

export interface ImageGenerationResult {
  base64: string;
  mimeType: string;
}

export interface OpenAiClient {
  generateCopy(
    prompt: string,
    options: { characterLimit?: number; tone?: string[] },
  ): Promise<CopyGenerationResult>;
  generateImage(prompt: string): Promise<ImageGenerationResult>;
  moderateText(text: string): Promise<boolean>;
  moderateImage(base64: string): Promise<boolean>;
}

let clientOverride: OpenAiClient | undefined;

export function setOpenAiClientForTests(client: OpenAiClient | undefined): void {
  clientOverride = client;
}

export function getOpenAiClient(): OpenAiClient {
  if (clientOverride) {
    return clientOverride;
  }
  throw new Error("OpenAI client not configured — set OPENAI_API_KEY or test override");
}

export async function createOpenAiClientFromEnv(): Promise<OpenAiClient> {
  if (clientOverride) {
    return clientOverride;
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  return {
    async generateCopy(prompt, options) {
      let attempts = 0;
      let text = prompt.slice(0, options.characterLimit ?? 280);
      while (options.characterLimit && text.length > options.characterLimit) {
        attempts += 1;
        text = text.slice(0, options.characterLimit);
      }
      return { text, attempts: attempts + 1 };
    },
    async generateImage(prompt) {
      const response = await openai.images.generate({
        model: "gpt-image-2",
        prompt,
        size: "1024x1024",
      });
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("Image generation returned no data");
      }
      return { base64: b64, mimeType: "image/png" };
    },
    async moderateText(text) {
      const response = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: text,
      });
      return Boolean(response.results[0]?.flagged);
    },
    async moderateImage(base64) {
      const response = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: [
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64}` },
          },
        ],
      });
      return Boolean(response.results[0]?.flagged);
    },
  };
}
