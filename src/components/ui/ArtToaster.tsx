"use client";

import { Toaster } from "react-hot-toast";

export default function ArtToaster() {
  return (
    <Toaster
      position="top-center"
      containerClassName="art-toasts"
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: "#ffffff",
          color: "#2d3748",
          fontFamily: "Inter, system-ui, sans-serif",
          border: "2px solid #2d3748",
          boxShadow: "3px 3px 0 #2d3748",
          fontSize: "0.875rem",
          padding: "0.75rem 1rem",
          borderRadius: "12px 3px 8px 6px",
          fontWeight: "600",
          maxWidth: "min(400px, calc(100vw - 2rem))",
          textAlign: "center",
        },
        success: {
          style: {
            background: "#f0fdf4",
            color: "#166534",
            borderColor: "#16a34a",
            boxShadow: "3px 3px 0 #16a34a",
          },
          iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
        },
        error: {
          style: {
            background: "#fef2f2",
            color: "#b91c1c",
            borderColor: "#dc2626",
            boxShadow: "3px 3px 0 #dc2626",
          },
          iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
        },
        loading: {
          style: {
            background: "#fefce8",
            color: "#a16207",
            borderColor: "#eab308",
            boxShadow: "3px 3px 0 #eab308",
          },
          iconTheme: { primary: "#eab308", secondary: "#ffffff" },
        },
      }}
    />
  );
}
