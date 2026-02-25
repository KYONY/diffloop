/**
 * Set up happy-dom globals for component testing.
 * Import this BEFORE any preact imports.
 */
import { GlobalWindow } from "happy-dom";

const win = new GlobalWindow({ url: "http://localhost:3000" });

globalThis.window = win as any;
globalThis.document = win.document as any;
globalThis.navigator = win.navigator as any;
globalThis.HTMLElement = win.HTMLElement as any;
globalThis.HTMLTextAreaElement = win.HTMLTextAreaElement as any;
globalThis.SVGElement = (win as any).SVGElement as any;
globalThis.Event = win.Event as any;
globalThis.MouseEvent = win.MouseEvent as any;
globalThis.KeyboardEvent = win.KeyboardEvent as any;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  setTimeout(cb, 0)) as any;
globalThis.cancelAnimationFrame = clearTimeout as any;
