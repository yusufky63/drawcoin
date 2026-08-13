import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function getAuthSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET (or NEXTAUTH_SECRET) must contain at least 32 characters."
    );
  }

  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(value)
    .digest("base64url");
}

export function sealAuthPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${encoded}.${sign(encoded)}`;
}

export function hashAuthIdentifier(identifier: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`drawcoin-auth-identifier:${identifier}`)
    .digest("hex");
}

export function unsealAuthPayload<T>(sealed: string): T | null {
  const separator = sealed.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = sealed.slice(0, separator);
  const providedSignature = sealed.slice(separator + 1);
  const expectedSignature = sign(encoded);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
