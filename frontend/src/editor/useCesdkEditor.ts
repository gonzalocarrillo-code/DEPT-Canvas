import { useEffect, useRef, useState } from "react";

export type CesdkStatus = "idle" | "loading" | "ready" | "no-license" | "error";

interface CesdkInstance {
  dispose?: () => void;
  createDesignScene?: () => Promise<unknown>;
}

// Mounts the CE.SDK browser editor as the WYSIWYG engine when a web license is present.
// Without VITE_CESDK_LICENSE (or before localhost is allowlisted on the trial key) it
// reports "no-license" and the editor falls back to the editable mock scene. The real
// engine drops into the same container the moment the license is connected.
export function useCesdkEditor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<CesdkStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const license = import.meta.env.VITE_CESDK_LICENSE?.trim();
    if (!license) {
      setStatus("no-license");
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let instance: CesdkInstance | null = null;
    setStatus("loading");

    void (async () => {
      try {
        const mod = await import("@cesdk/cesdk-js");
        const CreativeEditorSDK = mod.default as unknown as {
          version?: string;
          create: (el: HTMLElement, config: Record<string, unknown>) => Promise<CesdkInstance>;
        };
        const version = CreativeEditorSDK.version;
        const localAssets = import.meta.env.VITE_IMGLY_LOCAL_ASSETS_URL?.trim();
        const baseURL =
          localAssets ||
          (version
            ? `https://cdn.img.ly/packages/imgly/cesdk-js/${version}/assets`
            : undefined);

        const cesdk = await CreativeEditorSDK.create(el, {
          license,
          ...(baseURL ? { baseURL } : {}),
        });
        if (disposed) {
          cesdk.dispose?.();
          return;
        }
        instance = cesdk;
        await cesdk.createDesignScene?.();
        setStatus("ready");
      } catch (e) {
        if (disposed) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      instance?.dispose?.();
    };
  }, []);

  return { containerRef, status, error };
}
