import { ImageResponse } from "next/og";

export const alt = "DrawCoin - Draw, launch and collect original artwork on Base";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f5ff",
          color: "#171717",
          padding: "52px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "stretch",
            overflow: "hidden",
            background: "#ffffff",
            border: "5px solid #171717",
            borderRadius: "38px 16px 32px 22px",
            boxShadow: "14px 14px 0 #171717",
          }}
        >
          <div
            style={{
              width: "64%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "58px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                padding: "10px 18px",
                border: "3px solid #171717",
                borderRadius: "999px",
                background: "#e8f0ff",
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Made for Base App
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "28px",
                fontSize: "76px",
                fontWeight: 900,
                lineHeight: 0.98,
                letterSpacing: "-0.045em",
              }}
            >
              Draw it. Launch it. Collect the story.
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "26px",
                color: "#525252",
                fontSize: "25px",
                lineHeight: 1.35,
              }}
            >
              Original artwork, launched through Zora on Base.
            </div>
          </div>

          <div
            style={{
              width: "36%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0052ff",
              borderLeft: "5px solid #171717",
              padding: "42px",
            }}
          >
            <div
              style={{
                width: "250px",
                height: "250px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(2deg)",
                background: "#ffd166",
                border: "5px solid #171717",
                borderRadius: "42px 18px 36px 24px",
                boxShadow: "10px 10px 0 #171717",
              }}
            >
              <div style={{ display: "flex", fontSize: "86px", lineHeight: 1 }}>✦</div>
              <div
                style={{
                  display: "flex",
                  marginTop: "4px",
                  fontSize: "30px",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                DrawCoin
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
