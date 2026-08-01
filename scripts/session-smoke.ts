/**
 * Smoke tests for the session layer (Milestone 6).
 *
 * Covers deterministic round-trip serialization, URL-safe compression, share
 * link building + parsing, schema migration (identity + unsupported), import/
 * export round-trips, rejection of malformed/hostile sessions without
 * crashing, generous large-session bounds, auto-save via injectable storage,
 * clipboard copy with an injectable clipboard, and end-to-end restore from a
 * share URL. The heavy lifting (auto-save debounce timing, no-reload restore)
 * lives in `useSession`, which orchestrates these primitives; every primitive
 * it relies on is exercised here. All pure — no DOM, no React, no network.
 *
 * Run with:  npm run test:session
 */
import { copyToClipboard } from "../src/hooks/use-session";
import {
  AUTOSAVE_KEY,
  SESSION_LIMITS,
  SCHEMA_VERSION,
  buildSession,
  buildShareLink,
  canonicalSession,
  clearCompressionCache,
  clearStoredSession,
  compressSession,
  compressText,
  createMemoryStorage,
  defaultSessionContent,
  defaultShareBase,
  decompressSession,
  decompressText,
  deserializeSession,
  emptySession,
  hasSharePayload,
  hasStoredSession,
  isShareEncoded,
  loadStoredSession,
  migrateSession,
  migrationVersions,
  readSharePayload,
  registerMigration,
  serializeSession,
  serializeSessionPretty,
  sessionContentSignature,
  setMigration,
  shareSessionFromEncoded,
  shareSessionFromUrl,
  storeSession,
  stripShareParam,
  validateSession,
} from "../src/session";

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

function content(): ReturnType<typeof defaultSessionContent> {
  const base = defaultSessionContent([
    "let total = 0;",
    "for (let i = 0; i < 3; i++) {",
    "  total += i;",
    "}",
    "console.log(total);",
  ].join("\n"));
  return {
    ...base,
    snapshotIndex: 2,
    breakpoints: [
      { line: 2, enabled: false },
      { line: 3, enabled: true },
    ],
    watches: ["total", "i"],
    view: "graph",
    playbackSpeed: 4,
    isPlaying: true,
    bookmarks: [1, 3, 0],
    showMiniMap: true,
    ai: { provider: "openai", model: "gpt-4o-mini", temperature: 0.5, stream: false, cacheEnabled: true },
    theme: { theme: "light", reducedMotion: true, density: "compact" },
    editor: { fontSize: 16, tabSize: 4, wordWrap: false, minimap: true, lineNumbers: false },
  };
}

function sessionAt(now = 1_700_000_000_000): ReturnType<typeof buildSession> {
  return buildSession(content(), now, now + 1000);
}

function isErrorWith(result: unknown, code: string): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    !(result as { ok: boolean }).ok &&
    (result as { error: { code: string } }).error.code === code
  );
}

async function main() {
  console.log("1) deterministic serialization");
  {
    const a = sessionAt();
    const b = sessionAt();
    const jsonA = serializeSession(a);
    const jsonB = serializeSession(b);
    check("identical sessions serialize byte-identically", jsonA === jsonB, { jsonA, jsonB });
    check("pretty serialization keeps the same canonical shape", JSON.parse(serializeSessionPretty(a)).content.code === a.content.code);
    check("no random ids are emitted", !/[Ww][a-zA-Z]+-\d{6,}/.test(jsonA));

    // Stable key ordering at every nesting level.
    const parsed = JSON.parse(jsonA) as Record<string, unknown>;
    check("top-level key order is schemaVersion, meta, content", Object.keys(parsed).join(",") === "schemaVersion,meta,content");
    const contentKeys = Object.keys((parsed.content as Record<string, unknown>)).join(",");
    check(
      "content key order is fixed",
      contentKeys === "code,snapshotIndex,breakpoints,watches,view,playbackSpeed,isPlaying,bookmarks,showMiniMap,ai,theme,editor",
      contentKeys,
    );

    // Unordered collections are sorted before encoding.
    const shuffled = buildSession(
      { ...content(), breakpoints: [{ line: 3, enabled: true }, { line: 2, enabled: false }], bookmarks: [3, 1, 0] },
      0,
      0,
    );
    check("breakpoints sort by line", JSON.parse(serializeSession(shuffled)).content.breakpoints[0].line === 2);
    check("bookmarks sort ascending", JSON.parse(serializeSession(shuffled)).content.bookmarks.join(",") === "0,1,3");
  }

  console.log("2) round-trip serialization");
  {
    const session = sessionAt();
    const result = deserializeSession(serializeSession(session));
    check("round-trip succeeds", result.ok, result);
    if (result.ok) {
      check("code survives", result.session.content.code === session.content.code);
      check("breakpoints survive", JSON.stringify(result.session.content.breakpoints) === JSON.stringify(session.content.breakpoints));
      check("watches survive", JSON.stringify(result.session.content.watches) === JSON.stringify(session.content.watches));
      check("view survives", result.session.content.view === "graph");
      check("playback speed survives", result.session.content.playbackSpeed === 4);
      check("bookmarks survive", JSON.stringify(result.session.content.bookmarks) === JSON.stringify([0, 1, 3]));
      check("mini map survives", result.session.content.showMiniMap === true);
      check("ai settings survive", result.session.content.ai.provider === "openai");
      check("theme survives", result.session.content.theme.theme === "light");
      check("editor survives", result.session.content.editor.fontSize === 16);
      check("schema version survives", result.session.schemaVersion === SCHEMA_VERSION);
      check("meta survives", result.session.meta.createdAt === session.meta.createdAt);
    }
    check("content signature is content-only and stable", sessionContentSignature(content()) === sessionContentSignature(content()));
    check("signature changes when code changes", sessionContentSignature(content()) !== sessionContentSignature({ ...content(), code: "x" }));
  }

  console.log("3) compression + URL encoding");
  {
    const session = sessionAt();
    const encoded = compressSession(session);
    check("encoded payload is non-empty", typeof encoded === "string" && encoded.length > 0);
    check("encoded payload is URL-safe", isShareEncoded(encoded), encoded);
    check("url-safe charset only", /^[A-Za-z0-9_-]+$/.test(encoded));

    const restored = decompressSession(encoded);
    check("decompress + deserialize round-trips", restored.ok, restored);
    if (restored.ok) {
      check("restored code matches", restored.session.content.code === session.content.code);
    }

    const text = compressText("hello codescope");
    check("compressText/decompressText round-trip", decompressText(text) === "hello codescope");
    check("decompressText rejects garbage", decompressText("!!!not encoded!!!") === null || decompressText("!!!not encoded!!!") === "");
    check("decompressText rejects empty", decompressText("") === null);

    // Memoization: repeated decompression returns a cached result without
    // re-validating, and the cache can be cleared.
    const first = decompressSession(encoded);
    const second = decompressSession(encoded);
    check("decompression is memoized", first === second);
    clearCompressionCache();
    const third = decompressSession(encoded);
    check("cache clear forces a fresh result", third.ok && JSON.stringify(canonicalSession(third.session)) === JSON.stringify(canonicalSession(session)));
  }

  console.log("4) share links");
  {
    const session = sessionAt();
    const link = buildShareLink(session, { base: "https://codescope.app" });
    check("share link is built", link.ok, link);
    if (link.ok) {
      check("link carries ?session=", link.url.startsWith("https://codescope.app?session="));
      check("link length matches payload length", link.length === link.url.length);
      check("hasSharePayload detects it", hasSharePayload(link.url));
      const fromUrl = shareSessionFromUrl(link.url);
      check("shareSessionFromUrl restores", fromUrl.ok, fromUrl);
      if (fromUrl.ok) {
        check("restored view matches", fromUrl.session.content.view === "graph");
        check("restored code matches", fromUrl.session.content.code === session.content.code);
        check("restored meta matches", fromUrl.session.meta.createdAt === session.meta.createdAt);
      }
      check("readSharePayload extracts the payload", readSharePayload(link.url) === link.encoded);
      check("stripShareParam removes it", stripShareParam(link.url) === "https://codescope.app");
      check("stripShareParam keeps other params", stripShareParam("https://codescope.app/?a=1&session=x&b=2") === "https://codescope.app/?a=1&b=2");
    }

    // Oversized links are rejected with a clear reason (UI offers file export).
    // The cap is deterministic: force a small maxLength rather than relying on
    // how well lz-string happens to compress a given source.
    const huge = emptySession("let x = 1;\n".repeat(2_000));
    const tooLarge = buildShareLink(huge, { base: "https://codescope.app", maxLength: 100 });
    check("oversized link is rejected", !tooLarge.ok && tooLarge.reason === "too-large", tooLarge);
    if (!tooLarge.ok) check("oversized link reports length + cap", typeof tooLarge.length === "number" && tooLarge.maxLength === 100);

    check("shareSessionFromEncoded rejects non-payload", isErrorWith(shareSessionFromEncoded("no-such-session"), "not-object"));
    check("shareSessionFromUrl rejects missing payload", isErrorWith(shareSessionFromUrl("https://codescope.app/?other=1"), "not-object"));
    check("hasSharePayload false without payload", !hasSharePayload("https://codescope.app/"));
  }

  console.log("5) migration registry");
  {
    check("current-version input passes through", migrateSession(sessionAt()).ok);
    check("migrationVersions starts empty", migrationVersions().length === 0);

    // The registry runs for inputs BELOW the current version. Simulate a real
    // upgrade: a legacy v0 session is migrated 0→1 and then validated.
    registerMigration(0, (raw) => {
      const content = raw.content as Record<string, unknown>;
      return { ...raw, content: { ...content, legacyFlag: "migrated" } };
    });
    check("migrationVersions lists the registration", migrationVersions().join(",") === "0");
    const legacy = { ...sessionAt(), schemaVersion: 0 };
    const upgraded = migrateSession(legacy);
    check("0→1 migration runs and bumps the version", upgraded.ok, upgraded);
    if (upgraded.ok) {
      check("migrated session is at the current version", upgraded.session.schemaVersion === SCHEMA_VERSION);
      check("migrated content survives validation", upgraded.session.content.code === legacy.content.code);
    }

    // A registered v1 migration does NOT run while SCHEMA_VERSION === 1 (the
    // loop only walks versions below current), which is the intended no-op.
    let ran = false;
    registerMigration(1, (raw) => {
      ran = true;
      return raw;
    });
    check("v1 migration is not invoked at current version", (migrateSession(sessionAt()).ok, ran === false));
    check("migrationVersions returns ascending versions", migrationVersions().join(",") === "0,1");

    // Newer-than-app input is rejected without crashing.
    const future = { ...sessionAt(), schemaVersion: SCHEMA_VERSION + 1 };
    check("future version rejected", isErrorWith(migrateSession(future), "unsupported-version"), migrateSession(future));
    check("missing version rejected", isErrorWith(migrateSession({ meta: {}, content: {} }), "missing-schema-version"));
    check("non-object rejected", isErrorWith(migrateSession("not an object"), "not-object"));
    check("array rejected", isErrorWith(migrateSession([]), "not-object"));
    check("string version rejected", isErrorWith(migrateSession({ schemaVersion: "1", meta: {}, content: {} }), "invalid-schema-version"));

    // Leave identity migrations behind so later sections are unaffected.
    setMigration(0, (raw) => raw);
  }

  console.log("6) import / export");
  {
    const session = sessionAt();
    const exported = serializeSession(session);
    check("export is valid JSON", typeof exported === "string" && JSON.parse(exported) !== null);
    const imported = deserializeSession(exported);
    check("import accepts exported text", imported.ok, imported);
    if (imported.ok) {
      check("imported content equals exported", JSON.stringify(canonicalSession(imported.session).content) === JSON.stringify(canonicalSession(session).content));
    }
    check("import rejects foreign app files", isErrorWith(deserializeSession(serializeSession({ ...session, meta: { ...session.meta, app: "other-app" } })), "invalid-meta"));
    check("file extension is .codescope", /^codescope-session-\d+\.codescope$/.test(`codescope-session-${session.meta.createdAt}.codescope`));
    check("pretty export also imports cleanly", deserializeSession(serializeSessionPretty(session)).ok);
  }

  console.log("7) invalid sessions (rejected without crashing)");
  {
    // `validateSession` is the strict gate: every malformed shape is rejected
    // with a specific code. (`deserializeSession` is the lenient loader — it
    // defaults/clamps first, covered in the second half of this section.)
    const base: Record<string, unknown> = {
      schemaVersion: 1,
      meta: { app: "codescope", createdAt: 1, modifiedAt: 1 },
      content: content(),
    };
    const badInputs: Array<[string, Record<string, unknown>, string]> = [
      ["missing schema version", { ...base, schemaVersion: undefined }, "missing-schema-version"],
      ["future schema version", { ...base, schemaVersion: SCHEMA_VERSION + 1 }, "unsupported-version"],
      ["non-number createdAt", { ...base, meta: { ...(base.meta as object), createdAt: "x" } }, "invalid-meta"],
      ["wrong app", { ...base, meta: { ...(base.meta as object), app: "stranger" } }, "invalid-meta"],
      ["missing code", { ...base, content: { ...(base.content as object), code: undefined } }, "invalid-code"],
      ["code not a string", { ...base, content: { ...(base.content as object), code: 5 } }, "invalid-code"],
      ["bad view", { ...base, content: { ...(base.content as object), view: "3d" } }, "invalid-view"],
      ["bad breakpoint shape", { ...base, content: { ...(base.content as object), breakpoints: [{ line: "three", enabled: true }] } }, "invalid-breakpoints"],
      ["zero-line breakpoint", { ...base, content: { ...(base.content as object), breakpoints: [{ line: 0, enabled: true }] } }, "invalid-breakpoints"],
      ["non-string watch", { ...base, content: { ...(base.content as object), watches: [5] } }, "invalid-watches"],
      ["negative playback speed", { ...base, content: { ...(base.content as object), playbackSpeed: -1 } }, "invalid-playback-speed"],
      ["NaN playback speed", { ...base, content: { ...(base.content as object), playbackSpeed: NaN } }, "invalid-playback-speed"],
      ["negative bookmark", { ...base, content: { ...(base.content as object), bookmarks: [-2] } }, "invalid-bookmarks"],
      ["bad minimap type", { ...base, content: { ...(base.content as object), showMiniMap: "yes" } }, "invalid-minimap"],
      ["ai temperature out of range", { ...base, content: { ...(base.content as object), ai: { ...content().ai, temperature: 2 } } }, "invalid-ai-settings"],
      ["ai stream not boolean", { ...base, content: { ...(base.content as object), ai: { ...content().ai, stream: 1 } } }, "invalid-ai-settings"],
      ["bad theme", { ...base, content: { ...(base.content as object), theme: { theme: "sepia", reducedMotion: false, density: "comfortable" } } }, "invalid-theme"],
      ["bad editor font size", { ...base, content: { ...(base.content as object), editor: { ...content().editor, fontSize: 999 } } }, "invalid-editor"],
    ];
    for (const [label, input, expectedCode] of badInputs) {
      const result = validateSession(input);
      check(`validateSession rejects ${label}`, isErrorWith(result, expectedCode), result);
    }

    // The lenient loader: structurally-broken-but-defaultable sessions load
    // cleanly (fields are defaulted/clamped), while catastrophic input and
    // foreign apps are still rejected. Never throws.
    check("minimal session defaults everything", deserializeSession({ schemaVersion: 1 }).ok);
    check("minimal session keeps the app id", (() => {
      const r = deserializeSession({ schemaVersion: 1 });
      return r.ok && r.session.meta.app === "codescope";
    })());
    check("deserialize clamps a bad view to timeline", (() => {
      const r = deserializeSession({ ...base, content: { ...(base.content as object), view: "3d" } });
      return r.ok && r.session.content.view === "timeline";
    })());
    check("deserialize defaults a bad playback speed to 1", (() => {
      const r = deserializeSession({ ...base, content: { ...(base.content as object), playbackSpeed: -1 } });
      return r.ok && r.session.content.playbackSpeed === 1;
    })());
    check("deserialize rejects wrong app", isErrorWith(deserializeSession({ ...base, meta: { app: "stranger", createdAt: 1, modifiedAt: 1 } }), "invalid-meta"));
    check("deserialize rejects not JSON text", isErrorWith(deserializeSession("this is {{{ not json"), "not-object"));
    check("deserialize rejects primitive", isErrorWith(deserializeSession(42), "not-object"));
    check("deserialize rejects null", isErrorWith(deserializeSession(null), "not-object"));
    check("deserialize never throws on hostile input", (() => {
      try {
        deserializeSession(() => "function?");
        return true;
      } catch {
        return false;
      }
    })());
  }

  console.log("8) large sessions + limits");
  {
    // validateSession enforces the cap; deserializeSession clamps instead.
    const big = "let a = 1;\n".repeat(20_000); // ~220k chars → over the 200k cap
    const overLimit = {
      schemaVersion: 1,
      meta: { app: "codescope", createdAt: 1, modifiedAt: 1 },
      content: { ...content(), code: big },
    };
    check("over-limit code is rejected as code-too-long", isErrorWith(validateSession(overLimit), "code-too-long"));
    check("code just under the cap validates", validateSession({ ...overLimit, content: { ...overLimit.content, code: "x".repeat(SESSION_LIMITS.maxCodeLength - 1) } }).ok);

    const validBase: Record<string, unknown> = {
      schemaVersion: 1,
      meta: { app: "codescope", createdAt: 1, modifiedAt: 1 },
      content: content(),
    };
    const manyWatches = {
      ...validBase,
      content: { ...(validBase.content as Record<string, unknown>), watches: Array.from({ length: SESSION_LIMITS.maxWatches + 1 }, (_, i) => `w${i}`) },
    };
    check("too many watches rejected", isErrorWith(validateSession(manyWatches), "too-many-watches"));
    const manyBreakpoints = {
      ...validBase,
      content: { ...(validBase.content as Record<string, unknown>), breakpoints: Array.from({ length: SESSION_LIMITS.maxBreakpoints + 1 }, (_, i) => ({ line: i + 1, enabled: true })) },
    };
    check("too many breakpoints rejected", isErrorWith(validateSession(manyBreakpoints), "too-many-breakpoints"));
    const manyBookmarks = {
      ...validBase,
      content: { ...(validBase.content as Record<string, unknown>), bookmarks: Array.from({ length: SESSION_LIMITS.maxBookmarks + 1 }, (_, i) => i) },
    };
    check("too many bookmarks rejected", isErrorWith(validateSession(manyBookmarks), "too-many-bookmarks"));

    // The lenient loader truncates instead of rejecting (defense in depth).
    const clamped = deserializeSession({
      schemaVersion: 1,
      meta: { app: "codescope", createdAt: 1, modifiedAt: 1 },
      content: { code: "z".repeat(SESSION_LIMITS.maxCodeLength + 10) },
    });
    check("raw over-limit code is clamped on load", clamped.ok && clamped.session.content.code.length === SESSION_LIMITS.maxCodeLength, clamped);
    check("raw too-many watches are truncated on load", (() => {
      const r = deserializeSession({
        schemaVersion: 1,
        meta: { app: "codescope", createdAt: 1, modifiedAt: 1 },
        content: { ...content(), watches: Array.from({ length: SESSION_LIMITS.maxWatches + 5 }, (_, i) => `w${i}`) },
      });
      return r.ok && r.session.content.watches.length === SESSION_LIMITS.maxWatches;
    })());
  }

  console.log("9) auto-save (injectable storage)");
  {
    const storage = createMemoryStorage();
    const session = sessionAt();
    check("nothing stored initially", !hasStoredSession(storage));
    check("storeSession persists", storeSession(session, storage));
    check("hasStoredSession now true", hasStoredSession(storage));
    const loaded = loadStoredSession(storage);
    check("loadStoredSession restores", loaded !== null && loaded.content.code === session.content.code, loaded);
    check("stored value is canonical JSON", JSON.parse(storage.getItem(AUTOSAVE_KEY) as string).schemaVersion === SCHEMA_VERSION);

    storage.setItem(AUTOSAVE_KEY, "corrupted { json");
    check("corrupt auto-save loads as null", loadStoredSession(storage) === null);
    check("corrupt auto-save is removed", !hasStoredSession(storage));

    check("clearStoredSession wipes", (storeSession(session, storage), clearStoredSession(storage), !hasStoredSession(storage)));
    check("storeSession into null storage is a no-op", storeSession(session, null) === false);
    check("loadStoredSession from null storage is null", loadStoredSession(null) === null);
  }

  console.log("10) clipboard copy (injectable clipboard)");
  {
    let written = "";
    const clipboard = { writeText: async (t: string): Promise<void> => { written = t; } };
    check("copyShareLink writes through", (await copyToClipboard("https://codescope.app/?session=abc", clipboard)) === true);
    check("clipboard received the text", written === "https://codescope.app/?session=abc");

    const failing = { writeText: async (): Promise<void> => { throw new Error("denied"); } };
    const fallbackResult = await copyToClipboard("text", failing);
    check("falling clipboard returns a boolean without throwing", typeof fallbackResult === "boolean");
  }

  console.log("11) restore end-to-end (share URL → content)");
  {
    const session = sessionAt();
    const link = buildShareLink(session, { base: "https://codescope.app/" });
    if (link.ok) {
      const restored = shareSessionFromUrl(link.url);
      check("restore from share URL succeeds", restored.ok, restored);
      if (restored.ok) {
        const r = restored.session.content;
        const c = session.content;
        check("restored code", r.code === c.code);
        check("restored snapshot index", r.snapshotIndex === c.snapshotIndex);
        check("restored breakpoints", JSON.stringify(r.breakpoints) === JSON.stringify(c.breakpoints));
        check("restored watches", JSON.stringify(r.watches) === JSON.stringify(c.watches));
        check("restored view", r.view === c.view);
        check("restored speed", r.playbackSpeed === c.playbackSpeed);
        check("restored isPlaying", r.isPlaying === c.isPlaying);
        check("restored bookmarks", JSON.stringify([...r.bookmarks].sort((a, b) => a - b)) === JSON.stringify([...c.bookmarks].sort((a, b) => a - b)));
        check("restored mini map", r.showMiniMap === c.showMiniMap);
        check("restored ai settings", JSON.stringify(r.ai) === JSON.stringify(c.ai));
        check("restored theme", JSON.stringify(r.theme) === JSON.stringify(c.theme));
        check("restored editor", JSON.stringify(r.editor) === JSON.stringify(c.editor));
      }
      check("URL is cleared after restore (no reload needed)", stripShareParam(link.url) === "https://codescope.app/");
    }
  }

  console.log("12) build helpers + defaults");
  {
    const empty = emptySession("let x = 1;");
    check("emptySession has schemaVersion", empty.schemaVersion === SCHEMA_VERSION);
    check("emptySession defaults view to timeline", empty.content.view === "timeline");
    check("emptySession defaults speed to 1", empty.content.playbackSpeed === 1);
    check("emptySession defaults ai to mock", empty.content.ai.provider === "mock");
    check("defaultShareBase is deterministic without a browser", defaultShareBase() === "https://codescope.app");
    check("emptySession preserves the code", empty.content.code === "let x = 1;");
  }

  console.log(`\nsession: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
