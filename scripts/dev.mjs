import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(rootDir, "..");
const envPath = resolve(projectRoot, ".env");
const port = 8888;

loadEnvFile(envPath);

const items = buildItems();

const viteProcess = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev:vite"],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  },
);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (request.method === "GET" && requestUrl.pathname === "/items") {
      const body = await getItemsResponse();
      return sendJson(response, 200, body);
    }

    if (request.method === "POST" && requestUrl.pathname === "/vote") {
      const body = await readJsonBody(request);
      const result = await forwardVote(body);
      return sendJson(response, result.statusCode, result.body);
    }

    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Local API running on http://localhost:${port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  server.close();
  viteProcess.kill("SIGINT");
  process.exit(0);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFile(filePath, "utf8");

  contents
    .then((text) => {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const equalsIndex = trimmed.indexOf("=");

        if (equalsIndex === -1) {
          continue;
        }

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();

        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => {
      // Ignore unreadable env files and continue with the current process env.
    });
}

function buildItems() {
  const imageSeeds = [
    "aurora",
    "orchid",
    "solstice",
    "atlas",
    "harbor",
    "pulse",
    "ripple",
    "signal",
    "canvas",
    "ember",
    "lumen",
    "horizon",
  ];

  function makeImageUrl(seed) {
    return `https://picsum.photos/seed/${seed}/800/600`;
  }

  function makeVideoUrl() {
    return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  }

  return Array.from({ length: 28 }, (_, index) => {
    const title = `Item ${index + 1}`;
    const isVideo = index % 6 === 2;
    const seed = imageSeeds[index % imageSeeds.length];

    return {
      id: `item-${index + 1}`,
      title,
      description: isVideo
        ? "Pré-visualização em vídeo para testar o fluxo de voto."
        : "Imagem de exemplo para o card do concurso.",
      mediaType: isVideo ? "video" : "image",
      mediaUrl: isVideo ? makeVideoUrl() : makeImageUrl(seed),
      posterUrl: isVideo ? makeImageUrl(`${seed}-poster`) : undefined,
      voteCount: 0,
      createdAt: new Date("2026-06-05T00:00:00.000Z").toISOString(),
    };
  });
}

async function getItemsResponse() {
  const totals = await loadTotalsFromAppsScript();

  return {
    items: items.map((item) => ({
      ...item,
      voteCount: totals.get(item.id) ?? item.voteCount,
    })),
  };
}

async function forwardVote(body) {
  const parsed = typeof body === "string" ? safeJsonParse(body) : body;
  const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!appsScriptUrl || !appsScriptSecret) {
    return {
      statusCode: 500,
      body: { error: "APPS_SCRIPT_WEB_APP_URL and APPS_SCRIPT_SHARED_SECRET are required." },
    };
  }

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: appsScriptSecret,
      action: "vote",
      ...parsed,
    }),
  });

  const json = await response.json();

  return {
    statusCode: response.ok ? 200 : response.status,
    body: json,
  };
}

async function loadTotalsFromAppsScript() {
  const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const appsScriptSecret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!appsScriptUrl || !appsScriptSecret) {
    return new Map();
  }

  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: appsScriptSecret,
      action: "totals",
    }),
  });

  if (!response.ok) {
    return new Map();
  }

  const json = await response.json();
  return new Map(Object.entries(json.totals ?? {}));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      resolve(safeJsonParse(text));
    });
    request.on("error", reject);
  });
}

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });

  response.end(JSON.stringify(body));
}