import React from "react";

interface HandDrawnSkeletonProps {
  variant?: "card" | "text" | "circle" | "stat" | "profile" | "table";
  count?: number;
  className?: string;
}

export const HandDrawnSkeleton: React.FC<HandDrawnSkeletonProps> = ({
  variant = "card",
  count = 1,
  className = "",
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (variant === "card") {
    return (
      <>
        {skeletons.map((i) => (
          <div
            key={i}
            className={`hand-drawn-card animate-pulse ${className}`}
            style={{ transform: `rotate(${i % 2 === 0 ? "0.5deg" : "-0.5deg"})` }}
          >
            <div className="space-y-4">
              {/* Image placeholder */}
              <div
                className="w-full h-48 bg-art-gray-200 rounded-art"
                style={{ borderRadius: "15px 5px 10px 8px" }}
              />
              {/* Title */}
              <div className="space-y-2">
                <div className="h-6 bg-art-gray-200 rounded-art w-3/4" />
                <div className="h-4 bg-art-gray-200 rounded-art w-1/2" />
              </div>
              {/* Stats */}
              <div className="flex justify-between">
                <div className="h-4 bg-art-gray-200 rounded-art w-1/4" />
                <div className="h-4 bg-art-gray-200 rounded-art w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === "text") {
    return (
      <>
        {skeletons.map((i) => (
          <div
            key={i}
            className={`h-4 bg-art-gray-200 rounded-art animate-pulse ${className}`}
            style={{ borderRadius: "8px 3px 6px 4px" }}
          />
        ))}
      </>
    );
  }

  if (variant === "circle") {
    return (
      <>
        {skeletons.map((i) => (
          <div
            key={i}
            className={`bg-art-gray-200 animate-pulse ${className}`}
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50% 40% 50% 40%",
            }}
          />
        ))}
      </>
    );
  }

  if (variant === "stat") {
    return (
      <>
        {skeletons.map((i) => (
          <div
            key={i}
            className={`hand-drawn-card animate-pulse ${className}`}
            style={{ transform: `rotate(${i % 2 === 0 ? "0.3deg" : "-0.3deg"})` }}
          >
            <div className="space-y-2">
              <div className="h-4 bg-art-gray-200 rounded-art w-1/2" />
              <div className="h-8 bg-art-gray-200 rounded-art w-3/4" />
              <div className="h-3 bg-art-gray-200 rounded-art w-1/3" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === "profile") {
    return (
      <div className={`hand-drawn-card animate-pulse ${className}`}>
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div
            className="bg-art-gray-200"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50% 40% 50% 40%",
            }}
          />
          {/* Text */}
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-art-gray-200 rounded-art w-1/3" />
            <div className="h-4 bg-art-gray-200 rounded-art w-1/2" />
          </div>
          {/* Buttons */}
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-art-gray-200 rounded-art" />
            <div className="h-10 w-24 bg-art-gray-200 rounded-art" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`hand-drawn-card animate-pulse ${className}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="h-6 w-6 bg-art-gray-200 rounded-art" />
            <div className="h-6 bg-art-gray-200 rounded-art w-1/4" />
          </div>
          {/* Rows */}
          {skeletons.map((i) => (
            <div key={i} className="flex items-center space-x-4 py-3 border-t border-art-gray-100">
              <div
                className="bg-art-gray-200"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50% 40% 50% 40%",
                }}
              />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-art-gray-200 rounded-art w-1/3" />
                <div className="h-3 bg-art-gray-200 rounded-art w-1/4" />
              </div>
              <div className="h-4 bg-art-gray-200 rounded-art w-20" />
              <div className="h-8 w-8 bg-art-gray-200 rounded-art" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default HandDrawnSkeleton;


