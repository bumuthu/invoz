import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt parameters shared with tools/deployment/sftp_idp.py. */
export const secretScrypt = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 32,
  saltBytes: 16,
} as const;

/** Hash a verifier secret as `saltHex:digestHex`. The digest is 32 bytes and the salt is 16 bytes. */
export function hashSecret(secret: string): string {
  const salt = randomBytes(secretScrypt.saltBytes);
  const digest = scryptSync(secret, salt, secretScrypt.keyLength, {
    N: secretScrypt.N,
    r: secretScrypt.r,
    p: secretScrypt.p,
  });
  return `${salt.toString("hex")}:${digest.toString("hex")}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [saltHex, digestHex] = stored.split(":");
  if (!saltHex || !digestHex || saltHex.length !== 32 || digestHex.length !== 64) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(digestHex, "hex");
  if (salt.length !== secretScrypt.saltBytes || expected.length !== secretScrypt.keyLength) {
    return false;
  }
  const digest = scryptSync(secret, salt, expected.length, {
    N: secretScrypt.N,
    r: secretScrypt.r,
    p: secretScrypt.p,
  });
  return timingSafeEqual(digest, expected);
}
