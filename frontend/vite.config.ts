import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { aiGateway } from "./vite-ai-gateway";

// React + Tailwind v4 (CSS-first) + a dev-only AI gateway that reads OPENAI_API_KEY
// server-side (from frontend/.env.local or the process env).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      aiGateway({
        apiKey: env.OPENAI_API_KEY,
        planModel: env.OPENAI_PLAN_MODEL || "gpt-4o-mini",
        textModel: env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        imageModel: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      // Force a single React copy — @xyflow/react otherwise hits "Invalid hook call".
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "@xyflow/react"],
    },
    server: { host: "127.0.0.1", port: 5173 },
    preview: { host: "127.0.0.1", port: 4173 },
  };
});
