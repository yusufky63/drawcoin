"use client";
import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ChartNoAxesCombined,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Compass,
  Heart,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import TokenTicker from "./market/TokenTicker";
import { resolveCreatorBasenames } from "@/lib/creatorIdentityClient";

interface HeaderProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
}

interface UserInfo {
  name?: string;
  type?: "basename" | "farcaster" | "custom" | "wallet";
  fid?: number;
  pfpUrl?: string;
}

const desktopNavigation = [
  { href: "/", id: "explore", label: "Explore" },
  { href: "/markets", id: "markets", label: "Markets" },
  { href: "/create", id: "create", label: "Create" },
  { href: "/leaderboard", id: "leaderboard", label: "Leaderboard" },
  { href: "/missions", id: "missions", label: "Missions" },
] as const;

const desktopButtonBase =
  "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[16px_4px_13px_8px] px-3 text-[13px] font-bold no-underline transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] focus-visible:ring-offset-2 xl:px-4 xl:text-sm";
const desktopButtonActive =
  "-rotate-[0.4deg] border-[2.5px] border-solid border-[#2d3748] bg-[var(--base-blue)] text-white shadow-[3px_3px_0_#2d3748] hover:-translate-y-0.5 hover:bg-[var(--base-blue-hover)] hover:shadow-[4px_4px_0_#2d3748] active:translate-y-px active:shadow-[1px_1px_0_#2d3748]";
const desktopButtonInactive =
  "rotate-[0.35deg] border-[2.5px] border-dashed border-[#c6cbca] bg-white text-[#2d3748] hover:-translate-y-0.5 hover:-rotate-[0.4deg] hover:border-[#aeb5b3] hover:bg-[#2d3748]/[0.04]";
const desktopPrimaryButton =
  "-rotate-[0.35deg] border-[2.5px] border-solid border-[#23324a] bg-[var(--base-blue)] text-white shadow-[3px_3px_0_#23324a] hover:-translate-y-0.5 hover:bg-[var(--base-blue-hover)] hover:shadow-[4px_4px_0_#23324a] active:translate-y-px active:shadow-[1px_1px_0_#23324a]";

const mobileNavigation = [
  { href: "/", id: "explore", label: "Explore", Icon: Compass },
  {
    href: "/markets",
    id: "markets",
    label: "Markets",
    Icon: ChartNoAxesCombined,
  },
  { href: "/create", id: "create", label: "Create", Icon: Plus },
  {
    href: "/portfolio",
    id: "portfolio",
    label: "Portfolio",
    Icon: BriefcaseBusiness,
  },
] as const;

const mobileMenuNavigation = [
  {
    href: "/missions",
    id: "missions",
    label: "Missions",
    Icon: BadgeCheck,
  },
  {
    href: "/leaderboard",
    id: "leaderboard",
    label: "Leaderboard",
    Icon: Trophy,
  },
  {
    href: "/how-it-works",
    id: "info",
    label: "How it works",
    Icon: CircleHelp,
  },
] as const;

export default function ArtHeader({
  activeTab = "explore",
  userName,
}: HeaderProps) {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [userInfo, setUserInfo] = useState<UserInfo>({});
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const walletModalRef = useRef<HTMLDivElement>(null);
  const walletModalCloseRef = useRef<HTMLButtonElement>(null);
  const walletModalOpenerRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuFirstItemRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuFirstItemRef = useRef<HTMLAnchorElement>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth/siwe/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch (error) {
      console.warn("Wallet session sign-out failed", error);
    } finally {
      setShowAccountMenu(false);
      disconnect();
      setUserInfo({});
    }
  };

  // Update currentTab based on pathname
  useEffect(() => {
    setShowAccountMenu(false);
    setShowMobileMenu(false);

    if (pathname === "/") {
      setCurrentTab("explore");
    } else if (pathname === "/create") {
      setCurrentTab("create");
    } else if (pathname === "/portfolio") {
      setCurrentTab("portfolio");
    } else if (pathname === "/watchlist") {
      setCurrentTab("watchlist");
    } else if (pathname === "/leaderboard") {
      setCurrentTab("leaderboard");
    } else if (pathname === "/markets") {
      setCurrentTab("markets");
    } else if (pathname === "/missions") {
      setCurrentTab("missions");
    } else if (pathname === "/how-it-works") {
      setCurrentTab("info");
    } else if (pathname === "/live-canvas") {
      setCurrentTab("live-canvas");
    } else if (pathname.startsWith("/coin/")) {
      setCurrentTab("explore"); // Coin detail pages are part of explore
    } else {
      // Never carry an active navigation style across unrelated routes.
      setCurrentTab("");
    }
  }, [pathname]);

  // Prefer Base identity (Basename), then enrich with an optional Farcaster
  // social profile when no Basename is available.
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6_500);
    let isCurrent = true;

    const fetchUserInfo = async () => {
      if (userName) {
        if (isCurrent) {
          setUserInfo({ name: userName, type: "custom" });
        }
        return;
      }

      if (!isConnected || !address) {
        if (isCurrent) {
          setUserInfo({});
        }
        return;
      }

      setUserInfo({});

      try {
        // These are optional labels, not navigation prerequisites. Resolve
        // them concurrently so a slow ENS RPC cannot delay social fallback.
        const [basenameData, socialData] = await Promise.all([
          resolveCreatorBasenames([address]).then((basenames) => ({
            basename: basenames[address.toLowerCase()] ?? null,
          })),
          fetch(`/api/farcaster/user?address=${encodeURIComponent(address)}`, {
            signal: controller.signal,
          }).then(async (response) =>
            response.ok
              ? ((await response.json()) as {
            user?: {
              username?: string;
              displayName?: string;
              fid?: number;
              pfpUrl?: string;
            };
                })
              : null
          ),
        ]);

        if (!isCurrent) return;
        if (basenameData?.basename) {
          setUserInfo({ name: basenameData.basename, type: "basename" });
          return;
        }
        if (socialData?.user) {
          setUserInfo({
            name: socialData.user.username || socialData.user.displayName,
            type: "farcaster",
            fid: socialData.user.fid,
            pfpUrl: socialData.user.pfpUrl,
          });
          return;
        }

        if (isCurrent) {
          setUserInfo({});
        }
      } catch (error) {
        if (
          isCurrent &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          console.error("Error fetching user info:", error);
          setUserInfo({});
        }
      }
    };

    void fetchUserInfo();

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [userName, isConnected, address]);

  useEffect(() => {
    if (!showWalletModal) return;

    const dialog = walletModalRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      walletModalCloseRef.current?.focus();
    });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowWalletModal(false);
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => walletModalOpenerRef.current?.focus());
    };
  }, [showWalletModal]);

  useEffect(() => {
    if (!showAccountMenu) return;

    const focusFrame = window.requestAnimationFrame(() => {
      accountMenuFirstItemRef.current?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        !accountMenuRef.current?.contains(target) &&
        !accountMenuButtonRef.current?.contains(target)
      ) {
        setShowAccountMenu(false);
      }
    };

    const handleAccountMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setShowAccountMenu(false);
      window.requestAnimationFrame(() => accountMenuButtonRef.current?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleAccountMenuKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleAccountMenuKeyDown);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    if (!showMobileMenu) return;

    const focusFrame = window.requestAnimationFrame(() => {
      mobileMenuFirstItemRef.current?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        !mobileMenuRef.current?.contains(target) &&
        !mobileMenuButtonRef.current?.contains(target)
      ) {
        setShowMobileMenu(false);
      }
    };

    const handleMobileMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setShowMobileMenu(false);
      window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleMobileMenuKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleMobileMenuKeyDown);
    };
  }, [showMobileMenu]);

  return (
    <>
      {/* Sticky Container for Ticker and Header */}
      <div className="sticky top-0 z-50">
        <TokenTicker />

        {/* Desktop Header */}
        <header className="mb-2 hidden border-b-2 border-[#d8dde3] bg-white shadow-[0_4px_12px_rgba(45,55,72,0.08)] lg:block">
          <div className="mx-auto max-w-[1600px] px-4 xl:px-6">
            <div className="flex h-[70px] items-center justify-between gap-3 xl:gap-5">
              <div className="flex min-w-0 items-center gap-3 xl:gap-5">
                <Link
                  href="/"
                  aria-label="DrawCoin home, powered by Zora"
                  className="flex shrink-0 rotate-[0.5deg] flex-col items-start leading-none text-[#1a202c]"
                >
                  <span className="-rotate-[0.5deg] text-[22px] font-extrabold tracking-[-0.045em] [text-shadow:1px_1px_0_#2d3748] xl:text-2xl">
                    DrawCoin
                  </span>
                  <span className="mt-0.5 text-[9px] font-normal tracking-[-0.01em] text-[#718096] opacity-75 xl:text-[10px]">
                    powered by Zora
                  </span>
                </Link>

                <nav
                  aria-label="Primary navigation"
                  className="flex min-w-0 items-center gap-1.5 xl:gap-2.5"
                >
                  {desktopNavigation.map((item) => {
                    const isActive = currentTab === item.id;
                    const isMissions = item.id === "missions";
                    const isCreate = item.id === "create";

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`${desktopButtonBase} ${
                          isCreate
                            ? isActive
                              ? `${desktopPrimaryButton} ring-2 ring-[#9ab7ff] ring-offset-2`
                              : desktopButtonInactive
                            : isActive
                            ? desktopButtonActive
                            : desktopButtonInactive
                        } ${isMissions ? "hidden xl:inline-flex" : ""}`}
                      >
                        {isCreate ? (
                          <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
                        ) : null}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="flex shrink-0 items-center gap-2 xl:gap-3">
                {isConnected && address ? (
                  <>
                    <Link
                      href="/watchlist"
                      aria-label="Watchlist"
                      title="Watchlist"
                      aria-current={
                        currentTab === "watchlist" ? "page" : undefined
                      }
                      className={`${desktopButtonBase} gap-2 px-3 ${
                        currentTab === "watchlist"
                          ? desktopButtonActive
                          : desktopButtonInactive
                      }`}
                    >
                      <Heart aria-hidden="true" className="h-4 w-4" />
                      <span className="hidden xl:inline">Watchlist</span>
                    </Link>

                    <div
                      className="relative"
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget;
                        if (
                          !(nextTarget instanceof Node) ||
                          !event.currentTarget.contains(nextTarget)
                        ) {
                          setShowAccountMenu(false);
                        }
                      }}
                    >
                      <div className="flex min-h-10 -rotate-[0.25deg] items-stretch overflow-visible rounded-[16px_4px_13px_8px] border-[2.5px] border-solid border-[#2d3748] bg-white shadow-[2px_3px_0_#2d3748]">
                        <Link
                          href="/portfolio"
                          aria-current={
                            currentTab === "portfolio" ? "page" : undefined
                          }
                          className={`inline-flex items-center gap-1.5 rounded-l-[12px] border-r-2 border-[#2d3748] px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--base-blue)] xl:px-3 ${
                            currentTab === "portfolio"
                              ? "bg-[var(--base-blue)] text-white"
                              : "bg-white text-[#2d3748] hover:bg-[#f5f7fa]"
                          }`}
                        >
                          <BriefcaseBusiness
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                          <span className="hidden 2xl:inline">Portfolio</span>
                        </Link>

                        <button
                          ref={accountMenuButtonRef}
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={showAccountMenu}
                          aria-controls="desktop-account-menu"
                          onClick={() =>
                            setShowAccountMenu((isOpen) => !isOpen)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setShowAccountMenu(true);
                            }
                          }}
                          className={`flex min-w-0 items-center gap-2 rounded-r-[9px] px-2.5 text-[#2d3748] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--base-blue)] xl:px-3 ${
                            showAccountMenu
                              ? "bg-[#eef3ff]"
                              : "bg-white hover:bg-[#f5f7fa]"
                          }`}
                        >
                          {userInfo.type === "farcaster" && userInfo.pfpUrl ? (
                            <Image
                              src={userInfo.pfpUrl}
                              alt={userInfo.name || "Wallet profile"}
                              width={20}
                              height={20}
                              unoptimized
                              className="h-5 w-5 rounded-full border border-art-gray-300"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                            />
                          )}
                          <span className="sr-only">Wallet connected.</span>
                          <span className="max-w-[90px] truncate font-art-sans text-xs font-extrabold tracking-[-0.015em] xl:max-w-[116px]">
                            {userInfo.name
                              ? userInfo.type === "farcaster"
                                ? `@${userInfo.name}`
                                : userInfo.name
                              : `${address.substring(
                                  0,
                                  6
                                )}...${address.substring(address.length - 4)}`}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                              showAccountMenu ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>

                      {showAccountMenu && (
                        <div
                          ref={accountMenuRef}
                          id="desktop-account-menu"
                          role="menu"
                          aria-label="Account menu"
                          onKeyDown={(event) => {
                            if (
                              event.key !== "ArrowDown" &&
                              event.key !== "ArrowUp" &&
                              event.key !== "Home" &&
                              event.key !== "End"
                            ) {
                              return;
                            }

                            const menuItems = Array.from(
                              event.currentTarget.querySelectorAll<HTMLElement>(
                                '[role="menuitem"]'
                              )
                            );
                            if (menuItems.length === 0) return;

                            event.preventDefault();
                            const currentIndex = menuItems.indexOf(
                              document.activeElement as HTMLElement
                            );
                            let nextIndex = 0;

                            if (event.key === "End") {
                              nextIndex = menuItems.length - 1;
                            } else if (event.key === "ArrowDown") {
                              nextIndex = (currentIndex + 1) % menuItems.length;
                            } else if (event.key === "ArrowUp") {
                              nextIndex =
                                (currentIndex - 1 + menuItems.length) %
                                menuItems.length;
                            }

                            menuItems[nextIndex]?.focus();
                          }}
                          className="absolute right-0 top-[calc(100%+0.625rem)] z-[60] w-48 rounded-xl border-2 border-[#2d3748] bg-white p-1.5 shadow-[4px_4px_0_#2d3748]"
                        >
                          <button
                            ref={accountMenuFirstItemRef}
                            type="button"
                            role="menuitem"
                            onClick={() => void handleDisconnect()}
                            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-art-gray-700 transition-colors hover:bg-art-gray-100 hover:text-art-gray-900"
                          >
                            <LogOut aria-hidden="true" className="h-4 w-4" />
                            Disconnect
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={showWalletModal}
                    onClick={(event) => {
                      walletModalOpenerRef.current = event.currentTarget;
                      setShowWalletModal(true);
                    }}
                    disabled={isPending}
                    className={`${desktopButtonBase} ${desktopPrimaryButton} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isPending ? "Connecting..." : "Connect Wallet"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="mb-2 border-b-2 border-[#2d3748] bg-white shadow-[0_2px_0_#d1d5db] lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link
              href="/"
              aria-label="DrawCoin home, powered by Zora"
              className="flex shrink-0 flex-col items-start leading-none text-art-gray-900"
            >
              <span className="text-xl font-extrabold tracking-[-0.03em]">
                DrawCoin
              </span>
              <span className="mt-1 text-[8px] font-semibold tracking-[0.05em] text-art-gray-500">
                Powered by Zora
              </span>
            </Link>

            {isConnected && address ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href="/portfolio"
                  aria-label="Open portfolio"
                  className="flex h-10 min-w-0 items-center gap-2 rounded-[11px_5px_9px_7px] border-2 border-[#2d3748] bg-white px-2.5 text-art-gray-900 shadow-[2px_2px_0_#2d3748] transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-[var(--base-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] focus-visible:ring-offset-2"
                >
                  {userInfo.type === "farcaster" && userInfo.pfpUrl ? (
                    <Image
                      src={userInfo.pfpUrl}
                      alt={userInfo.name || "Wallet profile"}
                      width={20}
                      height={20}
                      unoptimized
                      className="h-5 w-5 shrink-0 rounded-full border border-art-gray-300"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    />
                  )}
                  <span className="sr-only">Wallet connected</span>
                  <span className="max-w-[112px] truncate text-xs font-extrabold tracking-[-0.015em] sm:max-w-[156px]">
                    {userInfo.name
                      ? userInfo.type === "farcaster"
                        ? `@${userInfo.name}`
                        : userInfo.name
                      : `${address.substring(0, 4)}...${address.substring(
                          address.length - 4
                        )}`}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  aria-label="Disconnect wallet"
                  title="Disconnect wallet"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#2d3748] bg-[#2d3748] text-white transition-colors hover:bg-art-gray-700"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={showWalletModal}
                onClick={(event) => {
                  walletModalOpenerRef.current = event.currentTarget;
                  setShowWalletModal(true);
                }}
                disabled={isPending}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-[#2d3748] bg-[var(--base-blue)] px-3 text-xs font-bold text-white shadow-[2px_2px_0_#2d3748] hover:bg-[var(--base-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <WalletCards aria-hidden="true" className="h-4 w-4" />
                {isPending ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-art-gray-300 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_rgba(17,24,39,0.08)] lg:hidden"
      >
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-5 px-2">
          {mobileNavigation.map(({ href, id, label, Icon }) => {
            const isActive = currentTab === id;
            const isCreate = id === "create";

            if (isCreate) {
              return (
                <Link
                  key={id}
                  href={href}
                  aria-label="Create a DrawCoin"
                  aria-current={isActive ? "page" : undefined}
                  className="relative flex min-w-0 flex-col items-center justify-end rounded-xl pb-1.5 text-[var(--base-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] focus-visible:ring-offset-2"
                >
                  <span
                    className={`absolute top-[-20px] inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#2d3748] shadow-[2px_3px_0_#2d3748] transition-[color,background-color,transform,box-shadow] ${
                      isActive
                        ? "-translate-y-0.5 scale-105 bg-[var(--base-blue)] text-white ring-2 ring-[#9ab7ff] ring-offset-2"
                        : "bg-white text-[var(--base-blue)] hover:-translate-y-0.5 hover:bg-[var(--base-blue-soft)]"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                  <span className="text-[10px] font-bold">{label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative mx-1 my-2 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors ${
                  isActive
                    ? "bg-[var(--base-blue-soft)] text-[var(--base-blue)]"
                    : "text-art-gray-500 hover:bg-art-gray-50 hover:text-art-gray-900"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 h-[3px] w-8 rounded-b-full bg-[var(--base-blue)]"
                  />
                )}
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="max-w-full truncate text-[10px] font-semibold">
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            ref={mobileMenuButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={showMobileMenu}
            aria-controls="mobile-more-menu"
            onClick={() => setShowMobileMenu((isOpen) => !isOpen)}
            className={`relative mx-1 my-2 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] focus-visible:ring-offset-2 ${
              showMobileMenu ||
              ["missions", "leaderboard", "watchlist", "info"].includes(
                currentTab
              )
                ? "bg-[var(--base-blue-soft)] text-[var(--base-blue)]"
                : "text-art-gray-500 hover:bg-art-gray-50 hover:text-art-gray-900"
            }`}
          >
            {(showMobileMenu ||
              ["missions", "leaderboard", "watchlist", "info"].includes(
                currentTab
              )) && (
              <span
                aria-hidden="true"
                className="absolute -top-2 h-[3px] w-8 rounded-b-full bg-[var(--base-blue)]"
              />
            )}
            <MenuIcon aria-hidden="true" className="h-5 w-5" />
            <span className="max-w-full truncate text-[10px] font-semibold">
              Menu
            </span>
          </button>
        </div>
      </nav>

      {showMobileMenu && (
        <div
          ref={mobileMenuRef}
          id="mobile-more-menu"
          role="menu"
          aria-label="More pages"
          onKeyDown={(event) => {
            if (
              event.key !== "ArrowDown" &&
              event.key !== "ArrowUp" &&
              event.key !== "Home" &&
              event.key !== "End"
            ) {
              return;
            }

            const menuItems = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="menuitem"]'
              )
            );
            if (menuItems.length === 0) return;

            event.preventDefault();
            const currentIndex = menuItems.indexOf(
              document.activeElement as HTMLElement
            );
            let nextIndex = 0;

            if (event.key === "End") {
              nextIndex = menuItems.length - 1;
            } else if (event.key === "ArrowDown") {
              nextIndex = (currentIndex + 1) % menuItems.length;
            } else if (event.key === "ArrowUp") {
              nextIndex =
                (currentIndex - 1 + menuItems.length) % menuItems.length;
            }

            menuItems[nextIndex]?.focus();
          }}
          className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom)+0.75rem)] z-[60] mx-auto grid max-w-sm grid-cols-2 gap-2 rounded-[18px_8px_15px_11px] border-2 border-[#2d3748] bg-white p-2.5 shadow-[4px_5px_0_#2d3748] lg:hidden"
        >
          {mobileMenuNavigation.map(({ href, id, label, Icon }, index) => {
            const isActive = currentTab === id;

            return (
              <Link
                key={id}
                ref={index === 0 ? mobileMenuFirstItemRef : undefined}
                href={href}
                role="menuitem"
                aria-current={isActive ? "page" : undefined}
                onClick={() => setShowMobileMenu(false)}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] ${
                  isActive
                    ? "border-[#9ab7ff] bg-[var(--base-blue-soft)] text-[var(--base-blue)]"
                    : "border-art-gray-200 bg-white text-art-gray-800 hover:border-art-gray-400 hover:bg-art-gray-50"
                }`}
              >
                <Icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}

          {isConnected && address && (
            <Link
              href="/watchlist"
              role="menuitem"
              aria-current={currentTab === "watchlist" ? "page" : undefined}
              onClick={() => setShowMobileMenu(false)}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--base-blue)] ${
                currentTab === "watchlist"
                  ? "border-[#9ab7ff] bg-[var(--base-blue-soft)] text-[var(--base-blue)]"
                  : "border-art-gray-200 bg-white text-art-gray-800 hover:border-art-gray-400 hover:bg-art-gray-50"
              }`}
            >
              <Heart aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
              <span>Watchlist</span>
            </Link>
          )}
        </div>
      )}

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowWalletModal(false);
            }
          }}
        >
          <div
            ref={walletModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            aria-describedby="wallet-dialog-description"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
            className="bg-white p-6 rounded-lg max-w-md w-full mx-4"
            style={{
              border: "3px solid #2d3748",
              borderRadius: "15px 5px 10px 8px",
              transform: "rotate(-0.5deg)",
              boxShadow: "5px 5px 0 #2d3748",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3
                id="wallet-dialog-title"
                className="text-lg font-bold text-art-gray-900"
              >
                Connect to DrawCoin
              </h3>
              <button
                ref={walletModalCloseRef}
                type="button"
                onClick={() => setShowWalletModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-art-gray-500 transition-colors hover:bg-art-gray-100 hover:text-art-gray-700"
                aria-label="Close wallet selection"
              >
                <X aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>

            <p
              id="wallet-dialog-description"
              className="mb-4 text-sm leading-5 text-art-gray-600"
            >
              Choose a wallet to continue on Base.
            </p>

            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  type="button"
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setShowWalletModal(false);
                  }}
                  disabled={isPending}
                  className="w-full p-3 border-2 border-art-gray-300 rounded-lg hover:border-art-gray-500 transition-colors text-left disabled:opacity-50"
                  style={{
                    borderRadius: "8px 3px 6px 4px",
                    transform: "rotate(0.5deg)",
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-art-gray-100 text-art-gray-600">
                      <WalletCards aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-art-gray-900">
                        {connector.name}
                      </div>
                      <div className="text-sm text-art-gray-500">
                        {connector.id === "baseAccount" && "Passkey wallet"}
                        {connector.id === "injected" &&
                          "MetaMask, Brave, etc."}
                        {connector.id === "walletConnect" && "Mobile wallets"}
                        {connector.id === "coinbaseWallet" &&
                          "Coinbase Wallet"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
