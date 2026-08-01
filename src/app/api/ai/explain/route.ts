import { NextRequest, NextResponse } from "next/server";
import { AIError } from "@/ai/types";
import type {
  AIErrorKind,
  AIProviderKind,
  ExplainPayload,
  ExplanationStreamEvent,
} from "@/ai/types";
import { createProvider } from "@/ai/provider";

export const runtime = "nodejs";

function statusFor(kind: AIErrorKind): number {
  switch (kind) {
    case "missing-api-key":
      return 401;
    case "rate-limit":
      return 429;
    case "cancelled":
      return 499;
    case "network":
      return 502;
    case "provider-unavailable":
      return 503;
    case "bad-response":
      return 502;
  }
}

interface ExplainBody {
  payload?: ExplainPayload;
  provider?: AIProviderKind;
  model?: string;
  temperature?: number;
  stream?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPayload(value: unknown): value is ExplainPayload {
  return isRecord(value) && typeof value.currentLine === "number";
}

/** POST /api/ai/explain — bridges the AI layer to the client.
 *
 * The API key never leaves the server: providers are created server-side from
 * environment variables. The client only supplies provider/model/temperature/
 * stream plus the (already-minimal) snapshot payload. Responses are SSE when
 * streaming, JSON otherwise.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: ExplainBody;
  try {
    body = (await request.json()) as ExplainBody;
  } catch {
    return NextResponse.json({ error: { kind: "bad-response", message: "Invalid request body." } }, { status: 400 });
  }

  const provider = body.provider ?? "mock";
  const model = typeof body.model === "string" && body.model.length > 0 ? body.model : undefined;
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;
  const stream = body.stream !== false;

  if (!isPayload(body.payload)) {
    return NextResponse.json({ error: { kind: "bad-response", message: "Invalid payload." } }, { status: 400 });
  }

  if (provider === "mock") {
    const instance = createProvider("mock", { model: model ?? "mock-default", temperature, stream });
    const explanation = await instance.complete(body.payload, { temperature });
    return NextResponse.json({ explanation, provider, model: instance.model });
  }

  const instance = createProvider(provider, { model, temperature, stream });
  const options = { temperature, signal: request.signal };

  if (!stream) {
    try {
      const explanation = await instance.complete(body.payload, options);
      return NextResponse.json({ explanation, provider, model: instance.model });
    } catch (error) {
      const ai = toAIError(error);
      return NextResponse.json({ error: { kind: ai.kind, message: ai.message } }, { status: statusFor(ai.kind) });
    }
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: ExplanationStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of instance.stream(body.payload!, options)) {
          enqueue(event);
          if (event.type === "complete" || event.type === "error") break;
        }
      } catch (error) {
        const ai = toAIError(error);
        enqueue({ type: "error", error: ai });
      } finally {
        try {
          controller.close();
        } catch {
          // client already disconnected
        }
      }
    },
  });

  return new NextResponse(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AIError("cancelled", "The request was cancelled.");
  }
  if (error instanceof TypeError) {
    return new AIError("network", "Network request failed.");
  }
  return new AIError("provider-unavailable", error instanceof Error ? error.message : String(error));
}
