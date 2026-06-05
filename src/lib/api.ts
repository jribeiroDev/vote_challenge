import type {
  ClientVoteMeta,
  VoteItem,
  VoteRequest,
  VoteResponse,
} from "../types";
import { items as localItems } from "../data/items";

type ItemsPayload = {
  items: VoteItem[];
};

const localVoteTotals = new Map(
  localItems.map((item) => [item.id, item.voteCount]),
);

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text();

    try {
      const parsed = JSON.parse(errorBody) as { error?: string };

      throw new Error(parsed.error ?? errorBody ?? "Pedido falhou.");
    } catch {
      throw new Error(errorBody || "Pedido falhou.");
    }
  }

  return (await response.json()) as T;
}

export async function fetchItems(): Promise<VoteItem[]> {
  try {
    const response = await fetch("/items");
    const payload = await readJson<ItemsPayload>(response);

    return payload.items;
  } catch {
    return localItems;
  }
}

export function getClientVoteMeta(): ClientVoteMeta {
  return {
    userAgent: window.navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    screen: `${window.screen.width}x${window.screen.height}`,
    locale: window.navigator.language,
  };
}

export async function submitVote(itemId: string): Promise<VoteResponse> {
  const payload: VoteRequest = {
    itemId,
    clientMeta: getClientVoteMeta(),
  };

  try {
    const response = await fetch("/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return await readJson<VoteResponse>(response);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }

    const nextTotal = (localVoteTotals.get(itemId) ?? 0) + 1;
    localVoteTotals.set(itemId, nextTotal);

    return {
      itemId,
      voteId: `local-${itemId}-${nextTotal}`,
      totalVotes: nextTotal,
    };
  }
}
