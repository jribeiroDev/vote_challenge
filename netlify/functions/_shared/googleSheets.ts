import { createHash } from "node:crypto";

type AppsScriptTotalsPayload = {
  ok: true;
  totals: Record<string, number>;
};

type AppsScriptVotePayload = {
  ok: true;
  itemId: string;
  voteId: string;
  totalVotes: number;
};

type AppsScriptLookupPayload = {
  ok: true;
  found: boolean;
};

type AppsScriptErrorPayload = {
  ok: false;
  error: string;
  code?: number;
};

export class AppsScriptError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "AppsScriptError";
    this.statusCode = statusCode;
  }
}

const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
const appsScriptSecret = process.env.APPS_SCRIPT_SHARED_SECRET;

export const hasAppsScriptConfig = Boolean(appsScriptUrl && appsScriptSecret);

function requireConfig() {
  if (!appsScriptUrl || !appsScriptSecret) {
    throw new Error("Apps Script is not configured.");
  }

  return { appsScriptUrl, appsScriptSecret };
}

function toError(message: string, statusCode = 500) {
  return new AppsScriptError(message, statusCode);
}

async function callAppsScript<T>(payload: Record<string, unknown>) {
  const { appsScriptUrl, appsScriptSecret } = requireConfig();

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      secret: appsScriptSecret,
      ...payload,
    }),
  });

  const rawBody = await response.text();

  let parsedBody: unknown = {};

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      throw toError(rawBody || "Apps Script request failed.", response.status);
    }
  }

  if (!response.ok) {
    const errorPayload = parsedBody as Partial<AppsScriptErrorPayload>;
    throw toError(
      errorPayload.error ??
        response.statusText ??
        "Apps Script request failed.",
      errorPayload.code ?? response.status,
    );
  }

  const payloadBody = parsedBody as Partial<AppsScriptErrorPayload> & T;

  if (payloadBody.ok === false) {
    throw toError(
      payloadBody.error ?? "Apps Script request failed.",
      payloadBody.code ?? 500,
    );
  }

  return payloadBody as T;
}

export async function loadVoteTotalsByItem() {
  const response = await callAppsScript<AppsScriptTotalsPayload>({
    action: "totals",
  });

  return new Map(Object.entries(response.totals ?? {}));
}

export async function findVoteByHouseholdHash(householdHash: string) {
  const response = await callAppsScript<AppsScriptLookupPayload>({
    action: "findVote",
    householdHash,
  });

  return response.found
    ? {
        rowNumber: 0,
        row: {
          household_hash: householdHash,
        },
      }
    : null;
}

export async function appendVoteRow(input: {
  voteId: string;
  itemId: string;
  ipHash: string;
  householdHash: string;
  createdAt: string;
  clientMeta: {
    userAgent: string;
    timezone: string;
    screen: string;
    locale: string;
  };
}) {
  return callAppsScript<AppsScriptVotePayload>({
    action: "vote",
    ...input,
  });
}

export function buildVoteHashes(input: {
  ip: string;
  clientMeta: {
    userAgent: string;
    timezone: string;
    screen: string;
    locale: string;
  };
}) {
  const salt = process.env.VOTE_HASH_SALT ?? "dev-salt";
  const ipRange = input.ip.includes(":")
    ? input.ip.split(":").slice(0, 4).join(":")
    : input.ip.split(".").slice(0, 3).join(".");

  return {
    ipHash: createHash("sha256").update(`${input.ip}${salt}`).digest("hex"),
    householdHash: createHash("sha256")
      .update(
        `${ipRange}${input.clientMeta.userAgent}${input.clientMeta.timezone}${input.clientMeta.screen}`,
      )
      .digest("hex"),
  };
}

export function resolveClientIp(headers: Record<string, string | undefined>) {
  const forwarded = headers["x-forwarded-for"];
  const netlifyIp = headers["x-nf-client-connection-ip"];
  const cfIp = headers["cf-connecting-ip"];

  return netlifyIp ?? cfIp ?? forwarded?.split(",")[0]?.trim() ?? "0.0.0.0";
}
