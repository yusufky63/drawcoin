"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { base } from "viem/chains";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import type { WalletSession } from "@/lib/auth/session";
import { isWalletSessionChainAllowed } from "@/lib/auth/chains";

type WalletSessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "signing";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Wallet sign-in failed.";
  } catch {
    return "Wallet sign-in failed.";
  }
}

export function useWalletSession() {
  const { address, chainId, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [session, setSession] = useState<WalletSession | null>(null);
  const [status, setStatus] = useState<WalletSessionStatus>("loading");

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/siwe/session", {
        method: "DELETE",
        credentials: "same-origin",
        signal: AbortSignal.timeout(8_000),
      });
    } finally {
      setSession(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetch("/api/auth/siwe/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as {
          session: WalletSession | null;
        };
        return body.session;
      })
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setStatus(nextSession ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      accountStatus === "connected" &&
      address &&
      session &&
      getAddress(address) !== getAddress(session.address)
    ) {
      void signOut();
    }
  }, [accountStatus, address, session, signOut]);

  const signIn = useCallback(async () => {
    if (!address) {
      throw new Error("Connect a wallet before signing in.");
    }

    setStatus("signing");

    try {
      const authChainId =
        chainId && isWalletSessionChainAllowed(chainId) ? chainId : base.id;

      if (chainId !== authChainId) {
        await switchChainAsync({ chainId: authChainId });
      }

      const nonceResponse = await fetch("/api/auth/siwe/nonce", {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(8_000),
      });
      if (!nonceResponse.ok) throw new Error(await readError(nonceResponse));

      const { nonce } = (await nonceResponse.json()) as { nonce: string };
      const issuedAt = new Date();
      const message = createSiweMessage({
        address: getAddress(address),
        chainId: authChainId,
        domain: window.location.host,
        expirationTime: new Date(issuedAt.getTime() + 5 * 60 * 1000),
        issuedAt,
        nonce,
        statement: "Sign in to DrawCoin.",
        uri: window.location.origin,
        version: "1",
      });
      const signature = await signMessageAsync({ message });
      const verifyResponse = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!verifyResponse.ok) {
        throw new Error(await readError(verifyResponse));
      }

      const body = (await verifyResponse.json()) as {
        session: WalletSession;
      };
      setSession(body.session);
      setStatus("authenticated");
      return body.session;
    } catch (error) {
      setSession(null);
      setStatus("unauthenticated");
      throw error;
    }
  }, [address, chainId, signMessageAsync, switchChainAsync]);

  return { session, status, signIn, signOut };
}
