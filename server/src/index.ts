import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateEarthPhysics, calculateRelativity } from "../../shared/src/physics";
import { earthDefaults, solarBodies } from "../../shared/src/solarSystem";
import type { ChatMessage, ChatSceneContext } from "../../shared/src/types";

const root = fileURLToPath(new URL("../../", import.meta.url));
const publicDir = join(root, "client", "dist");

loadDotenv(join(root, ".env"));

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4279);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === "/api/health") {
      return send(res, 200, { ok: true, name: "Astrophysica Playground" });
    }

    if (url.pathname === "/api/solar-system") {
      const earthPhysics = calculateEarthPhysics(earthDefaults);
      return send(res, 200, {
        bodies: solarBodies,
        earthDefaults,
        earthPhysics,
        notes: [
          "Curated real constants are used for the first release.",
          "Visual scale can be compressed so Neptune and the inner planets are visible together."
        ]
      });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await readJsonBody(req);
      return handleChat(res, body);
    }

    return serveStatic(url.pathname, res);
  } catch (err) {
    const status = typeof (err as { httpStatus?: unknown }).httpStatus === "number"
      ? Number((err as { httpStatus?: number }).httpStatus)
      : 500;
    send(res, status, {
      error: err instanceof Error ? err.message : "Unexpected server error"
    });
  }
}).listen(port, host, () => {
  console.log(`Astrophysica Playground API listening on http://${host}:${port}`);
});

async function handleChat(res: ServerResponse, body: unknown) {
  const apiKey = process.env.LLM_API_KEY || "";
  if (!apiKey || apiKey === "your_deepseek_key_here") {
    return send(res, 503, {
      code: "missing_llm_api_key",
      error: "Tutor needs LLM_API_KEY in .env. Copy .env.example to .env, paste your DeepSeek key, and restart npm run dev."
    });
  }

  const request = body as {
    messages?: ChatMessage[];
    sceneContext?: ChatSceneContext;
  };
  const messages = Array.isArray(request.messages) ? request.messages.slice(-10) : [];
  const sceneContext = request.sceneContext;
  const model = process.env.LLM_MODEL || "deepseek-chat";
  const endpoint = process.env.LLM_API_URL || "https://api.deepseek.com/chat/completions";
  const thinking = process.env.LLM_THINKING || "disabled";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 900,
      thinking: thinking ? { type: thinking } : undefined,
      messages: [
        {
          role: "system",
          content: buildTutorSystemPrompt(sceneContext)
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      ]
    }),
    signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 120000))
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return send(res, response.status >= 500 ? 502 : 400, {
      error: `Tutor API error ${response.status}: ${errorText.slice(0, 500)}`
    });
  }

  const result = await response.json();
  const answer = result.choices?.[0]?.message?.content || result.choices?.[0]?.message?.reasoning_content || "";
  return send(res, 200, {
    answer: answer || "I could not read a tutor answer from the provider response.",
    model: result.model || model,
    usage: result.usage || null
  });
}

function buildTutorSystemPrompt(sceneContext?: ChatSceneContext) {
  const computed = sceneContext
    ? {
        selectedBody: sceneContext.selectedBody,
        mode: sceneContext.mode,
        editedEarth: sceneContext.earth,
        blackHole: sceneContext.blackHole,
        physics: sceneContext.physics,
        relativity: sceneContext.relativity
      }
    : {};

  return [
    "You are the study tutor inside Astrophysica Playground, an astrophysics simulator.",
    "Explain physics clearly and visually. Use the current simulation numbers when useful.",
    "Be explicit about which formulas are Newtonian approximations and which are Schwarzschild relativity approximations.",
    "When a learner asks about tensors or Einstein equations, connect the concept to metric, curvature, worldlines, and stress-energy without overwhelming them.",
    `Current scene context JSON: ${JSON.stringify(computed)}`
  ].join("\n");
}

async function serveStatic(pathname: string, res: ServerResponse) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    return send(res, 403, { error: "Forbidden" });
  }

  try {
    const data = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    if (safePath !== "/index.html") {
      return serveStatic("/", res);
    }
    return send(res, 404, { error: "Build not found. Run npm run build first, or use npm run dev." });
  }
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) {
      throw Object.assign(new Error("Request body too large"), { httpStatus: 413 });
    }
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function loadDotenv(filePath: string) {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}
