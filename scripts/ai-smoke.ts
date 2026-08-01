/**
 * Smoke tests for the AI explanation layer (Milestone 5).
 *
 * Covers the snapshot → payload projection (security scrub: no source, no UI
 * state), prompt construction, the lenient JSON parser, snapshot hashing and
 * cache keys, the in-memory cache (hit/miss/eviction), provider selection and
 * error mapping (missing key, rate limit, unavailable, network, abort),
 * MockProvider determinism + streaming, the cache-aware orchestrator
 * (one-shot and streamed, cache hit/miss, stream fallback), and SSE parsing
 * for HTTP providers with a stubbed fetch. All pure — no DOM, no React, no
 * real network.
 *
 * Run with:  npm run test:ai
 */
import { runCode } from "../src/engine/index";
import type { ExecutionResult, Snapshot } from "../src/engine/index";
import {
  AI_PROVIDER_META,
  AIError,
  buildExplainPayload,
  buildExplainPrompt,
  createInMemoryCache,
  createProvider,
  explainSnapshot,
  explanationCacheKey,
  friendlyError,
  isUsableExplanation,
  parseExplanation,
  resolveEnvKey,
  snapshotHash,
  streamExplainSnapshot,
} from "../src/ai/index";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}`);
    if (detail !== undefined) console.error(`      ${JSON.stringify(detail)}`);
  }
}

function snapshotsOf(code: string): readonly Snapshot[] {
  const result: ExecutionResult = runCode(code);
  check(`execution succeeds: ${code.split("\n")[0].slice(0, 40)}`, result.ok, result);
  return result.snapshots;
}

async function main() {
const BASIC_CODE = [
  "let total = 0;",
  "// SECRET_MARKER_zz9_comment",
  "for (let i = 0; i < 3; i++) {",
  "  total = total + i;",
  "}",
  "console.log(total);",
].join("\n");

console.log("1) payload projection (security + structure)");
{
  const snapshots = snapshotsOf(BASIC_CODE);
  const previous = snapshots[0];
  const snapshot = snapshots[1];
  const payload = buildExplainPayload(snapshot, previous);

  check("currentLine is a positive number", typeof payload.currentLine === "number" && payload.currentLine > 0);
  check("description is a string", typeof payload.description === "string" && payload.description.length > 0);
  check("snapshotType is a string", typeof payload.snapshotType === "string" && payload.snapshotType.length > 0);
  check("variables is a plain record", typeof payload.variables === "object" && payload.variables !== null);
  check("callStack is an array", Array.isArray(payload.callStack));
  check("heap is an array", Array.isArray(payload.heap));
  check("console is an array", Array.isArray(payload.console));
  check("diff is present", typeof payload.diff === "object" && payload.diff !== null);
  check("diff carries changedVariables", Array.isArray(payload.diff.changedVariables));

  const json = JSON.stringify(payload);
  check("no source code in payload", !json.includes("SECRET_MARKER_zz9_comment"));
  check("no 'code' field in payload", !("code" in payload));
  check("no breakpoint/bookmark state in payload", !json.includes("breakpoint") && !json.includes("bookmark"));
  check("no frame ids in payload", !json.includes("frameId") && !json.includes("frame_id"));

  const second = buildExplainPayload(snapshots[2], snapshots[1]);
  check("a new snapshot projects to a new payload", JSON.stringify(second) !== json);
}

console.log("2) prompt construction");
{
  const snapshots = snapshotsOf(BASIC_CODE);
  const payload = buildExplainPayload(snapshots[1], snapshots[0]);
  const { system, user } = buildExplainPrompt(payload);

  check("system prompt is non-empty", system.length > 0);
  check("user prompt is non-empty", user.length > 0);
  check("system instructs structured JSON", /json/i.test(system));
  check("system forbids inventing state", /invent|unknown/i.test(system));
  check("user prompt embeds the payload as JSON", user.includes('"snapshotType"') && user.includes('"currentLine"') && user.trim().endsWith("}"));
  check("user prompt is deterministic", user === buildExplainPrompt(payload).user);

  // Same snapshot → identical prompt (cache safety).
  const samePayload = buildExplainPayload(snapshots[1], snapshots[0]);
  check("prompt is deterministic for identical payload", buildExplainPrompt(samePayload).user === user);
}

console.log("3) lenient explanation parser");
{
  const good: Record<string, unknown> = {
    summary: "s",
    reason: "r",
    changes: ["a → 1"],
    concept: "c",
    commonMistake: "m",
    nextStep: "n",
    confidence: "high",
  };
  const raw = JSON.stringify(good);
  const parsed = parseExplanation(raw);
  check("parses plain JSON", isUsableExplanation(parsed) && parsed?.summary === "s");
  check("confidence preserved", parsed?.confidence === "high");

  const fenced = `Here you go:\n\`\`\`json\n${raw}\n\`\`\``;
  const fencedParsed = parseExplanation(fenced);
  check("parses fenced JSON", isUsableExplanation(fencedParsed) && fencedParsed?.reason === "r");

  const padded = `prefix text ${raw} suffix`;
  const paddedParsed = parseExplanation(padded);
  check("parses embedded JSON object", isUsableExplanation(paddedParsed) && paddedParsed?.concept === "c");

  const badConfidence = JSON.stringify({ ...good, confidence: "super-duper" });
  const lowConf = parseExplanation(badConfidence);
  check("invalid confidence downgraded to low", lowConf?.confidence === "low");

  const missing = JSON.stringify({ foo: "bar" });
  check("object without fields is unusable", !isUsableExplanation(parseExplanation(missing)));

  const cases = ["", "   ", "not json at all", "{", "[]", "null", "123", '"a string"'];
  for (const weird of cases) {
    let threw = false;
    try {
      parseExplanation(weird);
    } catch {
      threw = true;
    }
    check(`parser never throws on: ${JSON.stringify(weird.slice(0, 12))}`, !threw);
  }
}

console.log("4) snapshot hashing and cache keys");
{
  const snapshots = snapshotsOf("let a = 1; let b = 2;");
  const [first, second] = snapshots;
  const hash = snapshotHash(first);
  check("snapshotHash is a string", typeof hash === "string" && hash.length > 0);
  check("snapshotHash deterministic", snapshotHash(first) === hash);
  check("snapshotHash differs across snapshots", snapshotHash(second) !== hash);

  const keyA = explanationCacheKey(first, undefined, "mock", "codescope-mock");
  const keyB = explanationCacheKey(first, undefined, "openai", "gpt-4o-mini");
  check("cache key includes provider", keyA !== keyB);
  const keyC = explanationCacheKey(first, undefined, "mock", "other-model");
  check("cache key includes model", keyA !== keyC);
  const keyPrev = explanationCacheKey(second, first, "mock", "codescope-mock");
  check("cache key includes the previous snapshot", keyA !== keyPrev);
  check("cache key deterministic", explanationCacheKey(first, undefined, "mock", "codescope-mock") === keyA);
}

console.log("5) in-memory cache");
{
  const cache = createInMemoryCache(2);
  const explanation = {
    summary: "s",
    reason: "r",
    changes: [] as string[],
    concept: "c",
    commonMistake: "m",
    nextStep: "n",
    confidence: "high" as const,
  };
  check("empty cache reports size 0", cache.size === 0);
  check("missing key not present", !cache.has("x"));
  cache.set("x", explanation);
  check("set then has", cache.has("x"));
  check("size after set", cache.size === 1);
  check("get returns the stored value", cache.get("x") === explanation);
  cache.set("y", explanation);
  cache.set("z", explanation);
  check("LRU evicts oldest after overflow", cache.size === 2 && !cache.has("x") && cache.has("y") && cache.has("z"));
  cache.clear();
  check("clear empties", cache.size === 0 && !cache.has("y"));
}

console.log("6) provider selection and env resolution");
{
  const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test" };
  check("resolveEnvKey reads the env map", resolveEnvKey("openai", env) === "sk-test");
  check("resolveEnvKey trims whitespace", resolveEnvKey("openai", { OPENAI_API_KEY: "  sk-x  " }) === "sk-x");
  check("resolveEnvKey ignores blank", resolveEnvKey("openai", { OPENAI_API_KEY: "   " }) === undefined);
  check("gemini uses its own key", resolveEnvKey("gemini", env) === undefined);
  check("mock has no key", resolveEnvKey("mock", env) === undefined);

  const openai = createProvider("openai", { env });
  check("openai factory builds openai", openai.kind === "openai");
  check("openai defaults the model", openai.model === AI_PROVIDER_META.openai.defaultModel);
  check("openai supports streaming", openai.supportsStreaming === true);

  const gemini = createProvider("gemini", { env });
  check("gemini factory builds gemini", gemini.kind === "gemini");

  const mock = createProvider("mock", { model: "codescope-mock", temperature: 0.2 });
  check("mock factory builds mock", mock.kind === "mock");
  check("mock always created without a key", mock.kind === "mock");
}

console.log("7) missing key and HTTP error mapping (stubbed fetch)");
{
  const env: Record<string, string | undefined> = {};
  const openai = createProvider("openai", { env });
  const payload = buildExplainPayload(snapshotsOf("let a = 1;")[0], undefined);

  let threw: unknown;
  try {
    await openai.complete(payload, { temperature: 0.2 });
  } catch (error) {
    threw = error;
  }
  check(
    "missing key → AIError missing-api-key",
    threw instanceof AIError && threw.kind === "missing-api-key",
    threw instanceof Error ? threw.message : threw,
  );

  const stub = (status: number): typeof fetch =>
    (async () => new Response(JSON.stringify({}), { status })) as unknown as typeof fetch;

  for (const [status, kind] of [
    [401, "missing-api-key"],
    [429, "rate-limit"],
    [500, "provider-unavailable"],
    [400, "bad-response"],
  ] as const) {
    const provider = createProvider("openai", { env: { OPENAI_API_KEY: "sk-x" }, fetchImpl: stub(status) });
    let caught: unknown;
    try {
      await provider.complete(payload, { temperature: 0.2 });
    } catch (error) {
      caught = error;
    }
    check(`HTTP ${status} → ${kind}`, caught instanceof AIError && caught.kind === kind, caught);
  }

  const rejecting = createProvider("openai", {
    env: { OPENAI_API_KEY: "sk-x" },
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch,
  });
  let netCaught: unknown;
  try {
    await rejecting.complete(payload, { temperature: 0.2 });
  } catch (error) {
    netCaught = error;
  }
  check("network failure → network", netCaught instanceof AIError && netCaught.kind === "network", netCaught);

  check("friendlyError maps every kind", ["missing-api-key", "network", "rate-limit", "provider-unavailable", "bad-response", "cancelled"]
    .every((k) => friendlyError(k as never).length > 0));
}

console.log("8) SSE parsing with a stubbed streamed response");
{
  const delta1 = JSON.stringify({ choices: [{ delta: { content: '{"sum' } }] });
  const delta2 = JSON.stringify({ choices: [{ delta: { content: 'mary":"a","reason":"r",' } }] });
  const delta3 = JSON.stringify({ choices: [{ delta: { content: '"changes":[],"concept":"c","commonMistake":"m","nextStep":"n","confidence":"high"}' } }] });
  const sseBody = `data: ${delta1}\n\ndata: ${delta2}\n\ndata: ${delta3}\n\ndata: [DONE]\n\n`;

  const streamedFetch = (async () => {
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseBody));
        controller.close();
      },
    }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }) as unknown as typeof fetch;

  const provider = createProvider("openai", {
    env: { OPENAI_API_KEY: "sk-x" },
    model: "gpt-4o-mini",
    temperature: 0.2,
    fetchImpl: streamedFetch,
  });

  const payload = buildExplainPayload(snapshotsOf("let a = 1;")[0], undefined);
  const events = [];
  for await (const event of provider.stream(payload, { temperature: 0.2 })) {
    events.push(event);
  }
  const kinds = events.map((e) => e.type);
  check("stream starts with a start event", kinds[0] === "start", kinds);
  check("stream emits deltas", kinds.includes("delta"), kinds);
  check("stream ends with complete", kinds[kinds.length - 1] === "complete", kinds);
  const complete = events.at(-1);
  check("streamed explanation is usable", complete?.type === "complete" && isUsableExplanation(complete.explanation));
  check("stream marks streamed true", complete?.type === "complete" && complete.streamed === true);
  const text = events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("");
  check("deltas reassemble the JSON", text.includes('"summary"') && text.includes('"confidence"'));
}

console.log("9) MockProvider determinism and streaming");
{
  const snapshots = snapshotsOf(BASIC_CODE);
  const mock = createProvider("mock", { model: "codescope-mock", temperature: 0.2 });
  const payload = buildExplainPayload(snapshots[1], snapshots[0]);

  const first = await mock.complete(payload, { temperature: 0.2 });
  const second = await mock.complete(payload, { temperature: 0.2 });
  check("mock complete is usable", isUsableExplanation(first));
  check("mock complete is deterministic", JSON.stringify(first) === JSON.stringify(second));
  check("mock summary mentions the line", first.summary.includes("line"));
  check("mock changes reflect the diff", Array.isArray(first.changes) && first.changes.length > 0);

  const events = [];
  for await (const event of mock.stream(payload, { temperature: 0.2 })) {
    events.push(event);
  }
  const kinds = events.map((e) => e.type);
  check("mock stream emits start", kinds[0] === "start", kinds);
  check("mock stream emits deltas", kinds.includes("delta"), kinds);
  check("mock stream ends with complete", kinds[kinds.length - 1] === "complete", kinds);
  const complete = events.at(-1);
  check("mock streamed explanation matches one-shot", complete?.type === "complete" && JSON.stringify(complete.explanation) === JSON.stringify(first));
}

console.log("10) orchestrator: one-shot cache hit/miss");
{
  const snapshots = snapshotsOf("let x = 10; let y = 20;");
  const cache = createInMemoryCache(10);
  const request = {
    snapshot: snapshots[1],
    previous: snapshots[0],
    provider: "mock" as const,
    model: "codescope-mock",
    temperature: 0.2,
    stream: false,
    cache,
  };

  const miss = await explainSnapshot(request);
  check("first call is a miss", miss.fromCache === false);
  check("first call returns a usable explanation", isUsableExplanation(miss.explanation));
  check("first call was not streamed", miss.streamed === false);
  check("cache now has an entry", cache.size === 1);

  const hit = await explainSnapshot(request);
  check("second call is a cache hit", hit.fromCache === true);
  check("cache hit returns the identical object", hit.explanation === miss.explanation);

  const sameKey = explanationCacheKey(request.snapshot, request.previous, "mock", "codescope-mock");
  check("cache key matches the stored key", cache.has(sameKey));

  const noCache = { ...request, cache: undefined };
  const again = await explainSnapshot(noCache);
  check("without a cache it always computes", again.fromCache === false);
}

console.log("11) orchestrator: streamed cache hit/miss + fallback");
{
  const snapshots = snapshotsOf("let a = 1; a = a + 1;");
  const cache = createInMemoryCache(10);
  const request = {
    snapshot: snapshots[1],
    previous: snapshots[0],
    provider: "mock" as const,
    model: "codescope-mock",
    temperature: 0.2,
    stream: true,
    cache,
  };

  const eventsMiss = [];
  for await (const event of streamExplainSnapshot(request)) {
    eventsMiss.push(event);
  }
  const kindsMiss = eventsMiss.map((e) => e.type);
  check("streamed miss emits start", kindsMiss[0] === "start", kindsMiss);
  check("streamed miss ends with complete", kindsMiss[kindsMiss.length - 1] === "complete", kindsMiss);
  const completeMiss = eventsMiss.at(-1);
  check("streamed miss has streamed=true", completeMiss?.type === "complete" && completeMiss.streamed === true);
  check("streamed miss is fromCache=false", completeMiss?.type === "complete" && completeMiss.fromCache === false);

  const eventsHit = [];
  for await (const event of streamExplainSnapshot(request)) {
    eventsHit.push(event);
  }
  const completeHit = eventsHit.at(-1);
  check("streamed hit emits a single complete", eventsHit.length === 1 && completeHit?.type === "complete");
  check("streamed hit is fromCache=true", completeHit?.type === "complete" && completeHit.fromCache === true);

  // Fallback: stream=false uses the one-shot path even on a streaming provider.
  const fallback = { ...request, stream: false, cache: undefined };
  const eventsFallback = [];
  for await (const event of streamExplainSnapshot(fallback)) {
    eventsFallback.push(event);
  }
  const fb = eventsFallback.at(-1);
  check("stream:false falls back to one-shot", eventsFallback.length === 1 && fb?.type === "complete" && fb.streamed === false);

  // Errors surface as error events, never uncaught.
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test";
  const broken = {
    ...request,
    provider: "openai" as const,
    model: "gpt-4o-mini",
    cache: undefined,
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch,
  };
  const eventsError = [];
  for await (const event of streamExplainSnapshot(broken)) {
    eventsError.push(event);
  }
  process.env.OPENAI_API_KEY = originalKey;
  const errorEvent = eventsError.at(-1);
  check("stream error surfaces as an error event", errorEvent?.type === "error", eventsError);
  check("stream error kind is network", errorEvent?.type === "error" && errorEvent.error.kind === "network");
}

console.log("12) abort is mapped to cancelled");
{
  const snapshots = snapshotsOf("let a = 1;");
  const controller = new AbortController();
  controller.abort();
  const abortingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as unknown as typeof fetch;

  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test";
  let caught: unknown;
  try {
    await explainSnapshot({
      snapshot: snapshots[0],
      previous: undefined,
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.2,
      stream: false,
      fetchImpl: abortingFetch,
      signal: controller.signal,
    });
  } catch (error) {
    caught = error;
  }
  process.env.OPENAI_API_KEY = originalKey;
  check("aborted request → cancelled", caught instanceof AIError && caught.kind === "cancelled", caught);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
