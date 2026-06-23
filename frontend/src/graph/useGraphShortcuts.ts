import { useEffect } from "react";
import { useGraphStore } from "./store";

// Cmd/Ctrl + C/V copies & pastes selected nodes; Z/Y (+Shift) undo & redo.
// Backspace/Delete is handled by React Flow's deleteKeyCode + onBeforeDelete.
// Ignored while typing in a node's input/textarea so editing keeps working.
export function useGraphShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const s = useGraphStore.getState();
      const key = e.key.toLowerCase();
      if (key === "c") {
        s.copyNodes();
      } else if (key === "v") {
        e.preventDefault();
        s.pasteNodes();
      } else if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (key === "y") {
        e.preventDefault();
        s.redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
