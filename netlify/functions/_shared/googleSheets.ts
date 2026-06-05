import { createHash } from "node:crypto";
import { google } from "googleapis";

type SheetRow = Record<string, string>;

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const serviceAccountPrivateKey =
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

const votesSheetName = process.env.GOOGLE_VOTES_SHEET_NAME ?? "Votes";

export const hasGoogleSheetsConfig = Boolean(
  spreadsheetId && serviceAccountEmail && serviceAccountPrivateKey,
);

const auth =
  hasGoogleSheetsConfig &&
  spreadsheetId &&
  serviceAccountEmail &&
  serviceAccountPrivateKey
    ? new google.auth.JWT({
        email: serviceAccountEmail,
        key: serviceAccountPrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    : null;

const sheets = auth ? google.sheets({ version: "v4", auth }) : null;

function requireConfig() {
  if (!hasGoogleSheetsConfig || !sheets || !spreadsheetId) {
    throw new Error("Google Sheets is not configured.");
  }

  return { sheets, spreadsheetId };
}

function normalizeRow(values: string[], headers: string[]) {
  return headers.reduce<SheetRow>((row, header, index) => {
    row[header] = (values[index] ?? "").trim();
    return row;
  }, {});
}

async function readSheetRows(range: string) {
  const { sheets, spreadsheetId } = requireConfig();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values ?? [];

  if (rows.length === 0) {
    return [] as Array<{ rowNumber: number; row: SheetRow }>;
  }

  const [headers, ...dataRows] = rows;

  return dataRows.map((values, index) => ({
    rowNumber: index + 2,
    row: normalizeRow(values.map(String), headers.map(String)),
  }));
}

export async function loadVoteTotalsByItem() {
  const rows = await readSheetRows(`${votesSheetName}!A:Z`);
  const totals = new Map<string, number>();

  for (const { row } of rows) {
    const itemId = row.item_id;

    if (!itemId) {
      continue;
    }

    totals.set(itemId, (totals.get(itemId) ?? 0) + 1);
  }

  return totals;
}

export async function findVoteByHouseholdHash(householdHash: string) {
  const rows = await readSheetRows(`${votesSheetName}!A:Z`);

  return rows.find(({ row }) => row.household_hash === householdHash) ?? null;
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
  const { sheets, spreadsheetId } = requireConfig();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${votesSheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          input.voteId,
          input.itemId,
          input.ipHash,
          input.householdHash,
          input.createdAt,
          input.clientMeta.userAgent,
          input.clientMeta.timezone,
          input.clientMeta.screen,
          input.clientMeta.locale,
        ],
      ],
    },
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
