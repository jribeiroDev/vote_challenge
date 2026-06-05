export type MediaType = "image" | "video";

export type VoteItem = {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  mediaUrl: string;
  posterUrl?: string;
  voteCount: number;
  createdAt: string;
};

export type VoteResponse = {
  itemId: string;
  voteId: string;
  totalVotes: number;
};

export type ClientVoteMeta = {
  userAgent: string;
  timezone: string;
  screen: string;
  locale: string;
};

export type VoteRequest = {
  itemId: string;
  clientMeta: ClientVoteMeta;
};
