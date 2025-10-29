import * as crypto from "node:crypto";

// Make crypto available globally for @nestjs/typeorm
// In Node.js 18+, crypto.randomUUID is not automatically available in the global scope
if (typeof global.crypto === "undefined") {
  (global as any).crypto = crypto;
}

