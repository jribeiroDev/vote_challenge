# Site de Votação

Aplicação React + Vite com Netlify Functions e Google Sheets via Apps Script como fonte de verdade.

O site é público e usa anti-spam leve para permitir apenas um voto por browser/dispositivo aproximado. Não há login nem link por pessoa.

## Como funciona

- O frontend envia metadados básicos do navegador para calcular um fingerprint leve
- A função `POST /vote` calcula `ip_hash` e `household_hash`
- O Netlify proxy fala com uma Web App do Apps Script
- O Apps Script grava o voto na sheet `Votes` e devolve os totais
- Se esse fingerprint já tiver votado, o voto é rejeitado

## Variáveis de ambiente

Cria um ficheiro `.env` com base em `.env.example`.

Required:

- `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_SHARED_SECRET`
- `VOTE_HASH_SALT`

## Apps Script

Cria um projeto do Google Apps Script ligado à tua Sheet e cola este código no ficheiro principal do script.

```javascript
const SHEET_NAME = "Votes";

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
  const headers = [
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
  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every(
    (header, index) => currentHeaders[index] === header,
  );

  if (headersMatch) {
    return;
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
```

Depois, em **Project Settings > Script properties**, cria `SHARED_SECRET` com o mesmo valor de `APPS_SCRIPT_SHARED_SECRET`.

Quando a app fizer o primeiro voto, o script cria automaticamente a aba `Votes` e escreve os cabeçalhos se ainda não existirem.

## Verificação da ligação

Para confirmar que a Sheet está ligada corretamente:

1. Faz o deploy do Apps Script como **Web app** com acesso para quem tiver o link.
2. Copia a URL que termina em `/exec` para `APPS_SCRIPT_WEB_APP_URL`.
3. Garante que `SHARED_SECRET` nas Script properties é exatamente igual a `APPS_SCRIPT_SHARED_SECRET`.
4. Faz um voto na app e confirma que o script cria a aba `Votes`, escreve os cabeçalhos e adiciona uma nova linha.

Se o voto não aparecer, o ponto mais provável a falhar é a URL do Web App, o valor do segredo, ou o script não estar ligado à própria Sheet.

## Estrutura da sheet

`Votes`:

- `vote_id`
- `item_id`
- `ip_hash`
- `household_hash`
- `created_at`
- `user_agent`
- `timezone`
- `screen`
- `locale`

Na primeira linha, cria exatamente esses cabeçalhos na mesma ordem.

## Desenvolvimento

```bash
npm install
npm run dev
```

Isto arranca um servidor local leve em `http://localhost:8888` para as rotas `/items` e `/vote` funcionarem com as funções.

Se quiseres abrir só o frontend Vite sem funções, usa `npm run dev:vite`.

## Build

```bash
npm run build
```
