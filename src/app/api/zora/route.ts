import { NextRequest, NextResponse } from "next/server";
import { getCoinDetails } from "../../../services/sdk/getCoins.js";
import { getZoraProfile, getProfileBalance } from "../../../services/sdk/getProfiles.js";
import { getFreshCryptoPrice } from "@/lib/server/cryptoPrice";
import {
  ApiInputError,
  normalizeEvmAddress,
} from "@/lib/api/requestValidation";

export const dynamic = "force-dynamic";

function jsonError(error: string, status: number, retryable = false) {
  return NextResponse.json(
    { error, ...(retryable && { retryable: true }) },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryable && { "Retry-After": "5" }),
      },
    }
  );
}

async function withTimeout<T>(work: Promise<T>, milliseconds = 6_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("The upstream request timed out.")),
          milliseconds
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readAddress(searchParams: URLSearchParams) {
  const values = searchParams.getAll("address");
  if (values.length !== 1) {
    throw new ApiInputError("One address parameter is required.");
  }
  const address = normalizeEvmAddress(values[0]);
  if (!address) throw new ApiInputError("The Base address is invalid.", 422);
  return address;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!action || searchParams.getAll("action").length !== 1) {
      throw new ApiInputError("One action parameter is required.");
    }


    if (action === "ethPrice") {
      try {
        const quote = await getFreshCryptoPrice("ETH");
        return NextResponse.json(quote, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        });
      } catch (error) {
        console.error("Failed to fetch ETH price:", error);
        return NextResponse.json(
          {
            error: "Live ETH price is temporarily unavailable.",
            retryable: true,
          },
          {
            status: 503,
            headers: {
              "Cache-Control": "no-store, max-age=0",
              "Retry-After": "10",
            },
          }
        );
      }
    }

    else if (action === "coinDetails") {
      const address = readAddress(searchParams);
      const coinData = await withTimeout(
        getCoinDetails(address, 8453, { maxRetries: 2, retryDelay: 500 })
      );
      return NextResponse.json(coinData, {
        headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
      });
    }

    else if (action === "profile") {
      const address = readAddress(searchParams);
      const profileData = await withTimeout(
        getZoraProfile(address, false, {
          maxRetries: 2,
          baseRetryDelay: 500,
        })
      );
      return NextResponse.json(profileData, {
        headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
      });
    }

    else if (action === "balance") {
      const address = readAddress(searchParams);
      const balanceData = await withTimeout(getProfileBalance(address));
      return NextResponse.json(balanceData, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } else {
      throw new ApiInputError("The action value is invalid.");
    }
  } catch (error) {
    if (error instanceof ApiInputError) {
      return jsonError(error.message, error.status);
    }
    console.error("Zora API error:", error);
    return jsonError("Zora data is temporarily unavailable.", 503, true);
  }
}
