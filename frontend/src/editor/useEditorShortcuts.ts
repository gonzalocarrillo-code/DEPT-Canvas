import { useEffect } from "react";
import { useEditorStore } from "./editorStore";

// Backspace/Delete + Cmd/Ctrl C/X/V/D for layers and keyframes. Ignored while typing
// in an input/textarea so text editing keeps working.
export function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      const s = useEditorStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (e.key === "Backspace" || e.key === "Delete") {
        if (s.selectedKeyframe) {
          e.preventDefault();
          s.deleteSelectedKeyframe();
        } else if (s.selectedId) {
          e.preventDefault();
          s.deleteLayer(s.selectedId);
        }
        return;
      }
      if (!mod) return;

      if (key === "c") {
        if (s.selectedKeyframe) s.copyKeyframe();
        else if (s.selectedId) s.copyLayer(s.selectedId);
      } else if (key === "x") {
        e.preventDefault();
        if (s.selectedKeyframe) {
          s.copyKeyframe();
          s.deleteSelectedKeyframe();
        } else if (s.selectedId) {
          s.cutLayer(s.selectedId);
        }
      } else if (key === "v") {
        e.preventDefault();
        if (s.lastCopied === "keyframe" && s.selectedId) s.pasteKeyframe();
        else s.pasteLayer();
      } else if (key === "d") {
        if (s.selectedId) {
          e.preventDefault();
          s.duplicateLayer(s.selectedId);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
