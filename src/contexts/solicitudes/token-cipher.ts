import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for OAuth refresh tokens stored in the database.
 * The key is derived from a server secret, so a database dump alone does not
 * expose access to the mailbox. Format: base64(iv).base64(tag).base64(ciphertext).
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(`mail-token:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
  }

  decrypt(payload: string): string {
    const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
    if (!iv || !tag || !encrypted) throw new Error("Token cifrado con formato inválido");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
