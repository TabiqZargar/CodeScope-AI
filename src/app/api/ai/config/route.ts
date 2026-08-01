import { NextResponse } from "next/server";
import { AI_PROVIDER_META, readProcessEnv, resolveEnvKey } from "@/ai/provider";

export const runtime = "nodejs";

/** GET /api/ai/config — reports which remote providers have an API key
 * configured server-side (never the keys themselves). The client uses this to
 * choose between the Local (mock) provider and a remote one.
 */
export function GET(): NextResponse {
  const env = readProcessEnv();
  const providers = Object.values(AI_PROVIDER_META).map((meta) => ({
    kind: meta.kind,
    label: meta.label,
    description: meta.description,
    envKey: meta.envKey,
    defaultModel: meta.defaultModel,
    configured: meta.kind === "mock" ? true : Boolean(resolveEnvKey(meta.kind, env)),
  }));
  return NextResponse.json({ providers });
}
