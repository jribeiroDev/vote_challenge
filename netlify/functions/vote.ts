import type { Handler } from "@netlify/functions";
import { items } from "../../src/data/items";
import {
  appendVoteRow,
  buildVoteHashes,
  findVoteByHouseholdHash,
  hasAppsScriptConfig,
  resolveClientIp,
  AppsScriptError,
} from "./_shared/googleSheets";

type VotePayload = {
  itemId?: string;
  clientMeta?: {
    userAgent: string;
    timezone: string;
    screen: string;
    locale: string;
  };
};

function json(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  let payload: VotePayload;

  try {
    payload = JSON.parse(event.body ?? "{}") as VotePayload;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (!payload.itemId) {
    return json(400, { error: "itemId is required." });
  }

  if (
    !payload.clientMeta?.userAgent ||
    !payload.clientMeta.timezone ||
    !payload.clientMeta.screen ||
    !payload.clientMeta.locale
  ) {
    return json(400, { error: "clientMeta is required." });
  }

  const item = items.find((candidate) => candidate.id === payload.itemId);

  if (!item) {
    return json(404, { error: "Item not found." });
  }

  if (hasAppsScriptConfig) {
    const ip = resolveClientIp(event.headers);
    const { ipHash, householdHash } = buildVoteHashes({
      ip,
      clientMeta: payload.clientMeta,
    });

    const existingVote = await findVoteByHouseholdHash(householdHash);

    // if (existingVote) {
    //   return json(409, { error: "This browser or device has already voted." });
    // }

    const voteId = `vote-${item.id}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    try {
      const voteResult = await appendVoteRow({
        voteId,
        itemId: item.id,
        ipHash,
        householdHash,
        createdAt: nowIso,
        clientMeta: payload.clientMeta,
      });

      return json(200, {
        itemId: item.id,
        voteId,
        totalVotes: voteResult.totalVotes,
      });
    } catch (error) {
      if (error instanceof AppsScriptError && error.statusCode === 409) {
        return json(409, { error: error.message });
      }

      throw error;
    }
  }

  return json(200, {
    itemId: item.id,
    voteId: `vote-${item.id}-${Date.now()}`,
    totalVotes: item.voteCount + 1,
  });
};
