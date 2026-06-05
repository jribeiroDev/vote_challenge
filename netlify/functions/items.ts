import type { Handler } from "@netlify/functions";
import { items } from "../../src/data/items";
import {
  hasGoogleSheetsConfig,
  loadVoteTotalsByItem,
} from "./_shared/googleSheets";

export const handler: Handler = async () => {
  if (hasGoogleSheetsConfig) {
    const voteTotals = await loadVoteTotalsByItem();

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          ...item,
          voteCount: voteTotals.get(item.id) ?? item.voteCount,
        })),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify({ items }),
  };
};
