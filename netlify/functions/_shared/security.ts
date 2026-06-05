import { createHash } from "node:crypto";
import type { ClientVoteMeta } from "../../../src/types";

const salt = process.env.VOTE_HASH_SALT || "dev-salt";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIpRange(ip: string) {
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }

  return ip.split(".").slice(0, 3).join(".");
}

export function buildHashes(ip: string, clientMeta: ClientVoteMeta) {
  const ipHash = sha256(`${ip}:${salt}`);
  const householdFingerprint = [
    normalizeIpRange(ip),
    clientMeta.userAgent,
    clientMeta.timezone,
    clientMeta.screen,
  ].join("|");

  return {
    ipHash,
    householdHash: sha256(`${householdFingerprint}:${salt}`),
  };
}

export function resolveClientIp(headers: Record<string, string | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const cfIp = headers["cf-connecting-ip"];
  const netlifyIp = headers["x-nf-client-connection-ip"];

  const candidate = netlifyIp ?? cfIp ?? forwarded?.split(",")[0]?.trim();

  return candidate || "0.0.0.0";
}
