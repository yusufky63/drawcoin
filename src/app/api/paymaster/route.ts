import { NextRequest, NextResponse } from "next/server";
import { validatePaymasterRequest } from "@/lib/badges/paymasterPolicy";
import { reservePaymasterGrant } from "@/lib/badges/paymasterGrantStore";
import {
  getConfiguredPaymasterServiceUrl,
  verifyPaymasterGrantToken,
} from "@/lib/badges/voucher";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 128_000;
const MAX_RESPONSE_BYTES = 1_000_000;

function jsonRpcError(
  status: number,
  code: number,
  message: string,
  id: string | number | null = null
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonRpcError(413, -32600, "Request is too large.");
  }

  const token = request.nextUrl.searchParams.get("token") || "";
  const grant = verifyPaymasterGrantToken(token);
  if (!grant) {
    return jsonRpcError(401, -32001, "Invalid or expired sponsorship grant.");
  }
  let rawBody: string;
  let body: unknown;
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return jsonRpcError(413, -32600, "Request is too large.");
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonRpcError(400, -32700, "Invalid JSON-RPC payload.");
  }

  const validation = await validatePaymasterRequest(body, grant);
  if (!validation.allowed) {
    return jsonRpcError(403, -32001, "This operation is not eligible for sponsorship.");
  }
  if (!(await reservePaymasterGrant(grant, validation.request.method))) {
    return jsonRpcError(
      429,
      -32005,
      "This sponsorship grant is unavailable or has already been used."
    );
  }
  const upstreamBody = JSON.stringify(validation.request);

  let upstreamUrl: URL;
  try {
    upstreamUrl = getConfiguredPaymasterServiceUrl();
  } catch {
    return jsonRpcError(503, -32003, "Sponsorship is not configured.");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10_000);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: upstreamBody,
      cache: "no-store",
      redirect: "error",
      signal: abortController.signal,
    });
    const responseText = await upstreamResponse.text();
    if (Buffer.byteLength(responseText, "utf8") > MAX_RESPONSE_BYTES) {
      return jsonRpcError(502, -32003, "Invalid response from sponsorship provider.");
    }

    return new Response(responseText, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonRpcError(502, -32003, "Sponsorship provider is unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}
