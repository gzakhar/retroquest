// Polyfills must be imported before anything else
import { Buffer } from "buffer";

// Make Buffer available globally
window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;
