const SHEET_NAME = "Votes";
const SHEET_HEADERS = [
  "vote_id",
  "item_id",
  "ip_hash",
  "household_hash",
  "created_at",
  "user_agent",
  "timezone",
  "screen",
  "locale",
];

function doPost(e) {
  try {
    const payload = JSON.parse(
      (e && e.postData && e.postData.contents) || "{}",
    );
    const secret =
      PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");

    if (!payload.secret || payload.secret !== secret) {
      return jsonResponse({ ok: false, error: "Unauthorized.", code: 401 });
    }

    if (payload.action === "totals") {
      return jsonResponse({ ok: true, totals: getTotals() });
    }

    if (payload.action === "findVote") {
      return jsonResponse({
        ok: true,
        found: hasHouseholdVote(payload.householdHash),
      });
    }

    if (payload.action === "vote") {
      return registerVote(payload);
    }

    return jsonResponse({ ok: false, error: "Unknown action.", code: 400 });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Request failed.",
      code: 500,
    });
  }
}

function registerVote(payload) {
  const sheet = getSheet();

  if (hasHouseholdVote(payload.householdHash)) {
    return jsonResponse({
      ok: false,
      error: "This browser or device has already voted.",
      code: 409,
    });
  }

  sheet.appendRow([
    payload.voteId,
    payload.itemId,
    payload.ipHash,
    payload.householdHash,
    payload.createdAt,
    payload.clientMeta.userAgent,
    payload.clientMeta.timezone,
    payload.clientMeta.screen,
    payload.clientMeta.locale,
  ]);

  const totals = getTotals();

  return jsonResponse({
    ok: true,
    itemId: payload.itemId,
    voteId: payload.voteId,
    totalVotes: totals[payload.itemId] || 1,
  });
}

function getTotals() {
  const values = getSheet().getDataRange().getValues();
  const rows = values.slice(1);
  const totals = {};

  rows.forEach((row) => {
    const itemId = row[1];

    if (!itemId) {
      return;
    }

    totals[itemId] = (totals[itemId] || 0) + 1;
  });

  return totals;
}

function hasHouseholdVote(householdHash) {
  if (!householdHash) {
    return false;
  }

  const values = getSheet().getDataRange().getValues();
  return values.slice(1).some((row) => row[3] === householdHash);
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("This script must be bound to a Google Sheet.");
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sheet);

  return sheet;
}

function ensureHeaders(sheet) {
  const currentHeaders = sheet
    .getRange(1, 1, 1, SHEET_HEADERS.length)
    .getValues()[0];
  const headersMatch = SHEET_HEADERS.every(
    (header, index) => currentHeaders[index] === header,
  );

  if (headersMatch) {
    return;
  }

  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
