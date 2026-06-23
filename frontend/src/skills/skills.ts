import { create } from "zustand";
import { persist } from "zustand/middleware";

// MD skills — reusable Markdown instruction packs the AI applies to a *specific*
// asset job (e.g. transcreation for Meta). The body is injected into the generation
// prompt for that asset only; channel-specific specs/data live here, not in code.
export interface Skill {
  id: string;
  name: string;
  channel: string;
  scope: string;
  summary: string;
  body: string; // Markdown
  builtin?: boolean;
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "meta-ads",
    name: "Meta Ads — transcreation",
    channel: "Meta",
    scope: "transcreation",
    summary: "Meta ad copy specs + transcreation rules (headline ≤40, primary ≤125).",
    builtin: true,
    body: `# Meta Ads — transcreation skill

**Use for:** transcreating ad copy (headlines / primary text) for Meta placements.

## Hard limits
- Primary text: front-load the hook; aim ≤125 chars before "See more" truncation.
- Headline: ≤40 chars, benefit-led, punchy.
- Link description: ≤30 chars.

## Voice
- **Transcreate, don't translate** — preserve intent, CTA energy and idiom per locale.
- ≤1 emoji, no ALL-CAPS, no clickbait, no prohibited claims (health/financial guarantees).
- Match Meta-native, conversational phrasing for the target market.

## Data the model should use
- Locale norms (formality, currency/format), Meta policy constraints, brand glossary (do-not-translate terms).`,
  },
  {
    id: "tiktok-native",
    name: "TikTok — native hook",
    channel: "TikTok",
    scope: "transcreation",
    summary: "Casual, native hook in the first 3 words; sound-on framing.",
    builtin: true,
    body: `# TikTok — native hook skill

- Hook in the **first 3 words**; write like a creator, not a brand.
- Casual, lower-case, trend-aware; ≤80 chars on-screen text.
- Assume sound-on; imply a caption/voiceover beat.
- Transcreate slang per locale; never literal.`,
  },
  {
    id: "google-display",
    name: "Google Display",
    channel: "Google",
    scope: "copy",
    summary: "Responsive display limits: headline ≤30, description ≤90.",
    builtin: true,
    body: `# Google Display — responsive copy skill

- Headline ≤30 chars; long headline ≤90; description ≤90.
- Clear value prop + CTA; no superlatives without proof.
- Keep punctuation light; sentence case.`,
  },
  {
    id: "product-photo",
    name: "Product photo — on-brand",
    channel: "Any",
    scope: "image",
    summary: "Clean studio product imagery; keep brand colors and safe zones.",
    builtin: true,
    body: `# Product photo — image skill

- Studio-clean, soft shadow, neutral or brand-tinted background.
- Keep the product centered with safe-zone margins; never crop the logo.
- Preserve brand palette; consistent lighting/angle across a variation set.`,
  },
];

function makeId(): string {
  try {
    return `skill-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `skill-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

export type NewSkill = Omit<Skill, "id" | "builtin">;

interface SkillsState {
  skills: Skill[];
  getSkill: (id: string | null | undefined) => Skill | undefined;
  addSkill: (input: NewSkill) => string;
  updateSkill: (id: string, patch: Partial<NewSkill>) => void;
  deleteSkill: (id: string) => void;
  resetBuiltins: () => void;
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set, get) => ({
      skills: BUILTIN_SKILLS,
      getSkill: (id) => (id ? get().skills.find((s) => s.id === id) : undefined),
      addSkill: (input) => {
        const id = makeId();
        set((s) => ({ skills: [...s.skills, { ...input, id }] }));
        return id;
      },
      updateSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch } : sk)),
        })),
      deleteSkill: (id) =>
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      // Re-add any built-ins that were deleted, without touching custom skills.
      resetBuiltins: () =>
        set((s) => {
          const have = new Set(s.skills.map((x) => x.id));
          const missing = BUILTIN_SKILLS.filter((b) => !have.has(b.id));
          return { skills: [...missing, ...s.skills] };
        }),
    }),
    { name: "dept-canvas-skills", version: 1 },
  ),
);
