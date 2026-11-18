import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const encoded = process.env.PAGA_BANK_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("PAGA_BANK_ENCRYPTION_KEY is required to store bank details.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("PAGA_BANK_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptPagaBankAccountNumber(accountNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accountNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptPagaBankAccountNumber(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || extra.length) {
    throw new Error("Stored bank account details have an unsupported format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
