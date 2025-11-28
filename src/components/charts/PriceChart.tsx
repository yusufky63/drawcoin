import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  LineStyle,
  AreaSeries,
  MouseEventParams,
} from "lightweight-charts";
import { formatEther } from "viem";
import { getOHLCV, OHLCVData } from "../../services/sdk/geckoTerminal";

interface PriceChartProps {
  poolAddress?: string;
  height?: number;
  poolKey?: any;
  currentPrice?: number;
  totalSupply?: string;
}

const TIMEFRAMES = [
  { label: "15M", value: "minute", aggregate: 15 },
  { label: "1H", value: "hour", aggregate: 1 },
  { label: "4H", value: "hour", aggregate: 4 },
  { label: "1D", value: "day", aggregate: 1 },
];

const formatPrice = (price: number) => {
  if (!price) return "0";
  if (price < 0.00001) return price.toExponential(4);
  if (price < 1) return price.toFixed(6);
  return price.toFixed(2);
};

const formatMarketCap = (val: number) => {
  if (!val) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(val);
};

export function PriceChart({
  poolAddress,
  height = 400,
  totalSupply,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"custom" | "embed">("custom");
  const [dataType, setDataType] = useState<"price" | "mc">("price");
  const [selectedTimeframe, setSelectedTimeframe] = useState(TIMEFRAMES[1]); // Default 1H

  const [rawData, setRawData] = useState<OHLCVData[]>([]);
  const [chartData, setChartData] = useState<OHLCVData[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch Data
  useEffect(() => {
    if (!poolAddress || mode === "embed") return;

    const fetchData = async () => {
      setLoading(true);
      const ohlcv = await getOHLCV(
        "base",
        poolAddress,
        selectedTimeframe.value as any,
        selectedTimeframe.aggregate
      );
      setRawData(ohlcv);
      setLoading(false);
    };

    fetchData();
  }, [poolAddress, selectedTimeframe, mode]);

  // 2. Process Data (Price vs MC)
  useEffect(() => {
    if (rawData.length === 0) {
      setChartData([]);
      return;
    }

    if (dataType === "mc" && totalSupply) {
      try {
        let supply = 0;
        // Heuristic: If length > 15, assume raw Wei (18 decimals). Else assume formatted.
        // Standard 1M supply with 18 decimals is 10^24 (length 25).
        // 1M supply formatted is "1000000" (length 7).
        const supplyStr = totalSupply.toString();
        if (supplyStr.length > 15) {
          supply = parseFloat(formatEther(BigInt(supplyStr)));
        } else {
          supply = parseFloat(supplyStr);
        }

        const mcData = rawData.map((d) => ({
          ...d,
          close: d.close * supply, // We only use close for AreaSeries
        }));
        setChartData(mcData);
      } catch (e) {
        console.error("Error calculating MC:", e);
        setChartData(rawData);
      }
    } else {
      setChartData(rawData);
    }
  }, [rawData, dataType, totalSupply]);

  // 3. Render Chart (Custom Mode)
  useEffect(() => {
    if (
      mode !== "custom" ||
      !chartContainerRef.current ||
      chartData.length === 0
    )
      return;

    // Cleanup previous chart
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        // Ignore disposal errors during cleanup
      }
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#4a5568",
        fontFamily: "'Kalam', cursive",
      },
      grid: {
        vertLines: { color: "#e2e8f0", style: LineStyle.Dashed },
        horzLines: { color: "#e2e8f0", style: LineStyle.Dashed },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        borderColor: "#cbd5e0",
        timeVisible: true,
        rightOffset: 0, // Remove right gap
      },
      rightPriceScale: {
        borderColor: "#cbd5e0",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: "#4a5568",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#4a5568",
        },
        horzLine: {
          width: 1,
          color: "#4a5568",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#4a5568",
        },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#4299e1",
      topColor: "rgba(66, 153, 225, 0.4)",
      bottomColor: "rgba(66, 153, 225, 0.0)",
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: dataType === "mc" ? formatMarketCap : formatPrice,
        minMove: dataType === "mc" ? 0.01 : 0.000000000000001,
      },
    });

    const lineData = chartData.map((d) => ({
      time: d.time as any,
      value: d.close,
    }));

    areaSeries.setData(lineData);
    chart.timeScale().fitContent();

    // Tooltip Logic
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!tooltipRef.current || !chartContainerRef.current) return;

      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        tooltipRef.current.style.display = "none";
      } else {
        tooltipRef.current.style.display = "block";
        const data = param.seriesData.get(areaSeries) as any;
        const price = data?.value;

        if (price) {
          const dateStr = new Date(
            (param.time as number) * 1000
          ).toLocaleString();
          const formatter = dataType === "mc" ? formatMarketCap : formatPrice;
          tooltipRef.current.innerHTML = `
                    <div class="font-bold text-indigo-600">${formatter(
                      price
                    )}</div>
                    <div class="text-xs text-gray-500">${dateStr}</div>
                `;

          // Position tooltip
          const tooltipWidth = 120;
          const tooltipHeight = 60;
          let left = param.point.x + 10;
          let top = param.point.y + 10;

          if (left + tooltipWidth > chartContainerRef.current.clientWidth) {
            left = param.point.x - tooltipWidth - 10;
          }
          if (top + tooltipHeight > chartContainerRef.current.clientHeight) {
            top = param.point.y - tooltipHeight - 10;
          }

          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        }
      }
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        } catch (e) {
          // Ignore disposal errors
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          // Ignore
        }
        chartRef.current = null;
      }
    };
  }, [chartData, height, mode, dataType]);

  if (!poolAddress) {
    return (
      <div
        className="w-full overflow-hidden rounded-lg border-2 border-art-gray-900 flex items-center justify-center bg-art-gray-50"
        style={{ height: `${height}px` }}
      >
        <p className="text-art-gray-500 font-bold">
          Chart unavailable (Pool not found)
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-lg border-2 border-art-gray-900 relative overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Controls Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 items-center">
        {/* Mode Toggle */}
        <div className="flex bg-white rounded-lg border-2 border-art-gray-300 overflow-hidden shadow-sm">
          <button
            onClick={() => setMode("custom")}
            className={`px-2 py-1 text-xs font-bold transition-colors ${
              mode === "custom"
                ? "bg-art-gray-100 text-art-gray-900"
                : "text-art-gray-500 hover:bg-gray-50"
            }`}
          >
            Custom
          </button>
          <div className="w-[2px] bg-art-gray-300"></div>
          <button
            onClick={() => setMode("embed")}
            className={`px-2 py-1 text-xs font-bold transition-colors ${
              mode === "embed"
                ? "bg-art-gray-100 text-art-gray-900"
                : "text-art-gray-500 hover:bg-gray-50"
            }`}
          >
            Embed
          </button>
        </div>

        {/* Custom Controls */}
        {mode === "custom" && (
          <>
            {/* Timeframes */}
            <div className="flex space-x-1 ml-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-2 py-1 text-xs font-bold rounded border-2 transition-transform shadow-sm ${
                    selectedTimeframe.label === tf.label
                      ? "bg-blue-100 border-blue-500 text-blue-700 transform -rotate-1"
                      : "bg-white border-art-gray-300 text-art-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Data Type Toggle (Price/MC) */}
            {totalSupply && (
              <div className="flex bg-white rounded-lg border-2 border-art-gray-300 overflow-hidden ml-2 shadow-sm">
                <button
                  onClick={() => setDataType("price")}
                  className={`px-2 py-1 text-xs font-bold transition-colors ${
                    dataType === "price"
                      ? "bg-green-100 text-green-800"
                      : "text-art-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Price
                </button>
                <div className="w-[2px] bg-art-gray-300"></div>
                <button
                  onClick={() => setDataType("mc")}
                  className={`px-2 py-1 text-xs font-bold transition-colors ${
                    dataType === "mc"
                      ? "bg-purple-100 text-purple-800"
                      : "text-art-gray-500 hover:bg-gray-50"
                  }`}
                >
                  MC
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Loading Overlay (Custom Only) */}
      {mode === "custom" && loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-20 bg-white/90 border-2 border-art-gray-200 rounded-lg p-2 pointer-events-none shadow-lg hidden"
      />

      {/* Chart Content */}
      {mode === "custom" ? (
        <div ref={chartContainerRef} className="w-full h-full" />
      ) : (
        <div className="w-full h-full pt-12">
          <iframe
            id="geckoterminal-embed"
            title="GeckoTerminal Chart"
            src={`https://www.geckoterminal.com/base/pools/${poolAddress}?embed=1&info=0&swaps=0`}
            style={{
              border: "none",
              width: "100%",
              height: "100%",
            }}
            allow="clipboard-write"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
