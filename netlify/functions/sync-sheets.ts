import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ok: true,
      syncedAt: new Date().toISOString(),
      note: "Sheet sync is stubbed until Neon aggregation is wired in.",
    }),
  };
};
