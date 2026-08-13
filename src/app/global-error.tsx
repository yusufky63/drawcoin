"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          color: "#171717",
          background: "#fafafa",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 20px",
            boxSizing: "border-box",
          }}
        >
          <section
            aria-labelledby="global-error-title"
            style={{
              width: "min(100%, 620px)",
              padding: "40px 28px",
              textAlign: "center",
              background: "#ffffff",
              border: "3px solid #171717",
              borderRadius: "28px 12px 24px 16px",
              boxShadow: "7px 7px 0 #171717",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "#0052ff",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              DrawCoin paused
            </p>
            <h1
              id="global-error-title"
              style={{ margin: 0, fontSize: "clamp(32px, 8vw, 52px)", lineHeight: 1.05 }}
            >
              The canvas could not open.
            </h1>
            <p style={{ margin: "18px auto 0", maxWidth: "480px", lineHeight: 1.7, color: "#525252" }}>
              Reload the DrawCoin experience. Your wallet will not be asked to
              approve anything by this action.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "12px",
                marginTop: "28px",
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  minHeight: "48px",
                  padding: "11px 24px",
                  border: "3px solid #171717",
                  borderRadius: "18px 7px 15px 10px",
                  boxShadow: "4px 4px 0 #171717",
                  background: "#0052ff",
                  color: "#ffffff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Reload DrawCoin
              </button>
              <Link
                href="/"
                style={{
                  minHeight: "48px",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 24px",
                  border: "2px dashed #737373",
                  borderRadius: "16px 9px 18px 7px",
                  color: "#171717",
                  fontWeight: 800,
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                Go home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
