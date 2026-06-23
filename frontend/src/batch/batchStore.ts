import { create } from "zustand";

// ── Asset-variation model ────────────────────────────────────────────────
// One master (design/video) has named asset slots. A variation *job* targets a
// single slot and produces N independent variants by either generating a new
// asset (image or text) or transcreating copy per locale. Each variant is a
// pre-render of the master with only that slot swapped; everything else (logo,
// layout, locked brand props) is held. Variants are approved / rejected / edited
// one at a time, then exported together.

export type VariantStatus = "queued" | "rendering" | "done" | "approved" | "rejected";
export type AssetType = "image" | "text";
export type VariationMode = "generate" | "transcreate";

export interface AssetSlot {
  id: string;
  name: string;
  type: AssetType;
  hint: string; // the master's current value, shown as context
  locked?: boolean; // brand-locked slots can't be varied
}

export interface Variant {
  id: string;
  label: string; // "v1" … or a locale code
  slotId: string;
  status: VariantStatus;
  hue: number;
  prompt: string; // the instruction that produced it (re-used by edit-with-AI)
  skillId: string | null;
  text?: string; // text-slot variant content
  locale?: string;
}

// The master's asset slots (mirrors the sample scene layers). Logo is brand-locked.
export const MASTER_SLOTS: AssetSlot[] = [
  { id: "background", name: "Background image", type: "image", hint: "Aurora gradient" },
  { id: "product", name: "Product image", type: "image", hint: "Hero product shot" },
  { id: "headline", name: "Headline", type: "text", hint: "Light that moves with you" },
  { id: "subhead", name: "Subhead", type: "text", hint: "The new Aurora collection" },
  { id: "cta", name: "Call to action", type: "text", hint: "Shop the drop" },
  { id: "logo", name: "Logo lockup", type: "image", hint: "Brand-locked", locked: true },
];

export const LOCALE_OPTIONS = ["EN", "ES", "FR", "DE", "JP", "BR", "IT", "KR"];

// Demo transcreations for the headline — the OpenAI gateway replaces this when wired.
const HEADLINE_TRANSCREATION: Record<string, string> = {
  EN: "Light that moves with you",
  ES: "Luz que se mueve contigo",
  FR: "Une lumière qui vous suit",
  DE: "Licht, das sich mit dir bewegt",
  JP: "あなたと動く光",
  BR: "Luz que acompanha você",
  IT: "Una luce che ti segue",
  KR: "당신과 함께 움직이는 빛",
};

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

function hueFor(i: number): number {
  return 200 + ((i * 47) % 150);
}

// Simulated AI output. Replaced by /api/ai/generate (OpenAI) once OPENAI_API_KEY is set.
function fakeText(slot: AssetSlot, prompt: string, i: number, locale?: string): string {
  if (locale) {
    if (slot.id === "headline" && HEADLINE_TRANSCREATION[locale]) {
      return HEADLINE_TRANSCREATION[locale];
    }
    return `[${locale}] ${slot.hint}`;
  }
  const seed = prompt.trim() || slot.hint;
  return `${seed} · take ${i + 1}`;
}

interface VariationState {
  projectId: string | null;
  slots: AssetSlot[];
  // job config
  targetSlotId: string;
  mode: VariationMode;
  instructions: string;
  count: number;
  locales: string[];
  skillId: string | null;
  keepAspect: boolean;
  // output
  variants: Variant[];
  generated: boolean;

  load: (projectId: string) => void;
  setTarget: (id: string) => void;
  setMode: (m: VariationMode) => void;
  setInstructions: (s: string) => void;
  setCount: (n: number) => void;
  toggleLocale: (l: string) => void;
  setSkill: (id: string | null) => void;
  setKeepAspect: (b: boolean) => void;
  plannedCount: () => number;
  generate: () => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  approveAll: () => void;
  editVariant: (id: string, prompt: string) => void;
  reset: () => void;
}

function settle(set: (fn: (s: VariationState) => Partial<VariationState>) => void, id: string, delay: number) {
  window.setTimeout(
    () => set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, status: "rendering" } : v)) })),
    delay,
  );
  window.setTimeout(
    () => set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, status: "done" } : v)) })),
    delay + 650,
  );
}

export const useBatchStore = create<VariationState>()((set, get) => ({
  projectId: null,
  slots: MASTER_SLOTS,
  targetSlotId: "background",
  mode: "generate",
  instructions: "",
  count: 6,
  locales: ["EN", "ES", "FR", "DE"],
  skillId: null,
  keepAspect: true,
  variants: [],
  generated: false,

  load: (projectId) => {
    if (get().projectId === projectId) return;
    set({ projectId, variants: [], generated: false });
  },
  setTarget: (id) => {
    const slot = get().slots.find((s) => s.id === id);
    // transcreation only applies to copy; snap back to generate for image slots
    set((s) => ({ targetSlotId: id, mode: slot?.type === "image" ? "generate" : s.mode }));
  },
  setMode: (m) => set({ mode: m }),
  setInstructions: (s) => set({ instructions: s }),
  setCount: (n) => set({ count: Math.max(1, Math.min(50, Math.round(n))) }),
  toggleLocale: (l) =>
    set((s) => ({
      locales: s.locales.includes(l) ? s.locales.filter((x) => x !== l) : [...s.locales, l],
    })),
  setSkill: (id) => set({ skillId: id }),
  setKeepAspect: (b) => set({ keepAspect: b }),

  plannedCount: () => {
    const s = get();
    return s.mode === "transcreate" ? s.locales.length : s.count;
  },

  generate: () => {
    const { mode, count, locales, targetSlotId, instructions, skillId, slots } = get();
    const slot = slots.find((s) => s.id === targetSlotId) ?? slots[0];
    const variants: Variant[] = [];
    if (mode === "transcreate") {
      locales.forEach((locale, i) => {
        variants.push({
          id: `${locale}-${makeId()}`,
          label: locale,
          slotId: slot.id,
          status: "queued",
          hue: hueFor(i),
          prompt: instructions,
          skillId,
          locale,
          text: fakeText(slot, instructions, i, locale),
        });
      });
    } else {
      for (let i = 0; i < count; i++) {
        variants.push({
          id: `v${i + 1}-${makeId()}`,
          label: `v${i + 1}`,
          slotId: slot.id,
          status: "queued",
          hue: hueFor(i),
          prompt: instructions,
          skillId,
          text: slot.type === "text" ? fakeText(slot, instructions, i) : undefined,
        });
      }
    }
    set({ variants, generated: true });
    variants.forEach((v, idx) => settle(set, v.id, 220 + idx * 120));
  },

  approve: (id) =>
    set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, status: "approved" } : v)) })),
  reject: (id) =>
    set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, status: "rejected" } : v)) })),
  approveAll: () =>
    set((s) => ({
      variants: s.variants.map((v) =>
        v.status === "done" || v.status === "rejected" ? { ...v, status: "approved" } : v,
      ),
    })),
  editVariant: (id, prompt) => {
    set((s) => ({
      variants: s.variants.map((v) =>
        v.id === id
          ? {
              ...v,
              prompt,
              status: "queued",
              text: v.text !== undefined ? `${prompt.trim() || v.text} ·` : v.text,
            }
          : v,
      ),
    }));
    settle(set, id, 150);
  },
  reset: () => set({ variants: [], generated: false }),
}));
