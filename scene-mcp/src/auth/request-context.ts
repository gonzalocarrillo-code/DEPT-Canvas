import { AsyncLocalStorage } from "node:async_hooks";
import type { CallerContext } from "./tenant-context.js";

export const requestContextStorage = new AsyncLocalStorage<CallerContext>();

export function getRequestCallerContext(
  fallback: () => CallerContext,
): CallerContext {
  return requestContextStorage.getStore() ?? fallback();
}
