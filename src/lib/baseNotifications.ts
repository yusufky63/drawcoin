import "server-only";

import { getAddress, isAddress, type Address } from "viem";

const BASE_DASHBOARD_API_ROOT = "https://dashboard.base.org/api/v1";

type NotificationConfiguration = {
  apiKey: string;
  appUrl: string;
};

type BaseDashboardErrorBody = {
  error?: string;
  message?: string;
  code?: string;
};

export type BaseNotificationUserStatus = {
  configured: true;
  appPinned: boolean;
  notificationsEnabled: boolean;
};

export type BaseNotificationDelivery =
  | {
      configured: false;
      delivered: false;
      reason: "not-configured";
    }
  | {
      configured: true;
      delivered: boolean;
      sentCount: number;
      failedCount: number;
      failureReason?: string;
    };

export class BaseNotificationError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "BaseNotificationError";
    this.status = status;
    this.retryable = retryable;
  }
}

function getConfiguration(): NotificationConfiguration | null {
  const apiKey = process.env.BASE_DASHBOARD_API_KEY?.trim();
  const appUrl =
    process.env.BASE_APP_URL?.trim() || process.env.NEXT_PUBLIC_URL?.trim();
  if (!apiKey || !appUrl) return null;

  try {
    const parsedAppUrl = new URL(appUrl);
    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      parsedAppUrl.protocol === "http:" &&
      (parsedAppUrl.hostname === "localhost" ||
        parsedAppUrl.hostname === "127.0.0.1");
    if (parsedAppUrl.protocol !== "https:" && !isLocalDevelopment) return null;
  } catch {
    return null;
  }

  return { apiKey, appUrl };
}

export function getBaseNotificationConfigurationStatus():
  | { configured: true; appUrl: string }
  | { configured: false } {
  const configuration = getConfiguration();
  return configuration
    ? { configured: true, appUrl: configuration.appUrl }
    : { configured: false };
}

function normalizeWalletAddress(value: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new BaseNotificationError("Invalid wallet address.", 400);
  }
  return getAddress(value);
}

async function callBaseDashboard<T>(
  path: string,
  configuration: NotificationConfiguration,
  init: RequestInit
): Promise<T> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8_000);

  try {
    const response = await fetch(`${BASE_DASHBOARD_API_ROOT}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": configuration.apiKey,
        ...init.headers,
      },
      signal: abortController.signal,
    });

    let responseBody: unknown;
    try {
      responseBody = (await response.json()) as unknown;
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      const errorBody = responseBody as BaseDashboardErrorBody | null;
      const safeMessage =
        errorBody?.message ||
        errorBody?.error ||
        `Base Notifications API returned HTTP ${response.status}.`;
      throw new BaseNotificationError(
        safeMessage,
        response.status,
        response.status === 429 || response.status === 503
      );
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof BaseNotificationError) throw error;
    throw new BaseNotificationError("Base Notifications API is unavailable.", 503, true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBaseNotificationUserStatus(
  walletAddress: string
): Promise<BaseNotificationUserStatus | { configured: false }> {
  const configuration = getConfiguration();
  if (!configuration) return { configured: false };

  const address = normalizeWalletAddress(walletAddress);
  const response = await callBaseDashboard<{
    appPinned: boolean;
    notificationsEnabled: boolean;
  }>("/notifications/app/user/status", configuration, {
    method: "POST",
    body: JSON.stringify({
      app_url: configuration.appUrl,
      wallet_address: address,
    }),
  });

  return {
    configured: true,
    appPinned: response.appPinned === true,
    notificationsEnabled: response.notificationsEnabled === true,
  };
}

export async function getBaseNotificationAudiencePage(options?: {
  cursor?: string;
  limit?: number;
  notificationsEnabledOnly?: boolean;
}): Promise<
  | { configured: false; users: []; nextCursor?: undefined }
  | {
      configured: true;
      users: Array<{ address: Address; notificationsEnabled: boolean }>;
      nextCursor?: string;
    }
> {
  const configuration = getConfiguration();
  if (!configuration) return { configured: false, users: [] };

  const query = new URLSearchParams({ app_url: configuration.appUrl });
  query.set("limit", String(Math.min(500, Math.max(1, options?.limit || 100))));
  if (options?.cursor) query.set("cursor", options.cursor);
  if (options?.notificationsEnabledOnly !== false) {
    query.set("notification_enabled", "true");
  }

  const response = await callBaseDashboard<{
    success: boolean;
    users: Array<{ address: string; notificationsEnabled: boolean }>;
    nextCursor?: string;
  }>(`/notifications/app/users?${query.toString()}`, configuration, {
    method: "GET",
  });

  const users = response.users.flatMap((user) => {
    try {
      return [
        {
          address: normalizeWalletAddress(user.address),
          notificationsEnabled: user.notificationsEnabled === true,
        },
      ];
    } catch {
      return [];
    }
  });

  return {
    configured: true,
    users,
    nextCursor: response.nextCursor,
  };
}

export async function sendBaseNotification(input: {
  walletAddresses: string[];
  title: string;
  message: string;
  targetPath?: string;
}): Promise<BaseNotificationDelivery> {
  const configuration = getConfiguration();
  if (!configuration) {
    return { configured: false, delivered: false, reason: "not-configured" };
  }

  const title = input.title.trim();
  const message = input.message.trim();
  const targetPath = input.targetPath?.trim();
  const addresses = Array.from(
    new Set(input.walletAddresses.map(normalizeWalletAddress))
  );

  if (addresses.length < 1 || addresses.length > 1_000) {
    throw new BaseNotificationError(
      "A notification must target between 1 and 1,000 wallets.",
      400
    );
  }
  if (!title || title.length > 30) {
    throw new BaseNotificationError(
      "Notification title must contain at most 30 characters.",
      400
    );
  }
  if (!message || message.length > 200) {
    throw new BaseNotificationError(
      "Notification message must contain at most 200 characters.",
      400
    );
  }
  if (targetPath && (!targetPath.startsWith("/") || targetPath.length > 500)) {
    throw new BaseNotificationError(
      "Notification target path must start with / and contain at most 500 characters.",
      400
    );
  }

  const response = await callBaseDashboard<{
    success: boolean;
    results: Array<{
      walletAddress: string;
      sent: boolean;
      failureReason?: string;
    }>;
    sentCount: number;
    failedCount: number;
  }>("/notifications/send", configuration, {
    method: "POST",
    body: JSON.stringify({
      app_url: configuration.appUrl,
      wallet_addresses: addresses,
      title,
      message,
      ...(targetPath ? { target_path: targetPath } : {}),
    }),
  });

  return {
    configured: true,
    delivered: response.sentCount > 0,
    sentCount: response.sentCount,
    failedCount: response.failedCount,
    failureReason: response.results.find((result) => !result.sent)?.failureReason,
  };
}

export async function sendMissionBadgeNotification(
  walletAddress: string,
  badgeName: string
): Promise<BaseNotificationDelivery> {
  const normalizedBadgeName = badgeName.trim().slice(0, 120);
  return sendBaseNotification({
    walletAddresses: [walletAddress],
    title: "Badge unlocked",
    message: `${normalizedBadgeName} badge is now in your DrawCoin collection.`,
    targetPath: "/missions",
  });
}
