"use client";

import { useId, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DailyClose } from "@/lib/finance/calculations";
import {
  buildChartSeries,
  calculateChartChange,
  type ChartRange,
} from "@/lib/finance/chart";

const ranges: ChartRange[] = ["1W", "1M", "3M", "MAX"];
const width = 720;
const height = 270;
const margin = { top: 18, right: 18, bottom: 34, left: 58 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const axisMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function dateValue(tradingDate: string) {
  return new Date(`${tradingDate}T00:00:00Z`);
}

export default function PriceHistoryChart({
  history,
  symbol,
}: {
  history: DailyClose[];
  symbol: string;
}) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = `price-area-${useId().replaceAll(":", "")}`;
  const points = buildChartSeries(history, range);
  const change = calculateChartChange(points);

  if (points.length < 2) {
    return (
      <section className="price-chart-card price-chart-empty" aria-label="Price history">
        <strong>Recent price trend</strong>
        <p>
          The chart will appear after at least two daily closing prices are cached.
        </p>
      </section>
    );
  }

  const prices = points.map((point) => point.close);
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const dataSpan = dataMax - dataMin;
  const padding = dataSpan === 0 ? Math.max(dataMax * 0.01, 0.5) : dataSpan * 0.12;
  const chartMin = dataMin - padding;
  const chartMax = dataMax + padding;
  const chartSpan = chartMax - chartMin;
  const xFor = (index: number) =>
    margin.left + (index / (points.length - 1)) * plotWidth;
  const yFor = (price: number) =>
    margin.top + ((chartMax - price) / chartSpan) * plotHeight;
  const coordinates = points.map((point, index) => ({
    x: xFor(index),
    y: yFor(point.close),
  }));
  const linePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPath = [
    `M ${coordinates[0].x} ${margin.top + plotHeight}`,
    ...coordinates.map(({ x, y }) => `L ${x} ${y}`),
    `L ${coordinates.at(-1)!.x} ${margin.top + plotHeight}`,
    "Z",
  ].join(" ");
  const tone = !change || change.amount === 0
    ? "neutral"
    : change.amount > 0
      ? "positive"
      : "negative";
  const stroke = tone === "positive"
    ? "#16845b"
    : tone === "negative"
      ? "#c24141"
      : "#1d63d5";
  const activeIndex = hoveredIndex ?? points.length - 1;
  const activePoint = points[activeIndex];
  const activeCoordinate = coordinates[activeIndex];
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      value: chartMax - chartSpan * ratio,
      y: margin.top + plotHeight * ratio,
    };
  });
  const xLabelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    const relative = Math.min(Math.max(pointerX - margin.left, 0), plotWidth);
    setHoveredIndex(
      Math.round((relative / plotWidth) * (points.length - 1)),
    );
  }

  return (
    <section className="price-chart-card" aria-label={`${symbol} recent price history`}>
      <div className="price-chart-header">
        <div>
          <span className="price-chart-label">Recent price trend</span>
          {change && (
            <strong className={`price-chart-change value-${tone}`}>
              {change.amount > 0 ? "+" : ""}
              {money.format(change.amount)}
              <small>
                {change.percent > 0 ? "+" : ""}
                {change.percent.toFixed(2)}%
              </small>
            </strong>
          )}
        </div>
        <div className="price-chart-readout" aria-live="polite">
          <strong>{money.format(activePoint.close)}</strong>
          <span>{fullDate.format(dateValue(activePoint.tradingDate))}</span>
        </div>
      </div>

      <div className="chart-range-tabs" role="group" aria-label="Price chart range">
        {ranges.map((option) => (
          <button
            key={option}
            className={option === range ? "chart-range chart-range-active" : "chart-range"}
            type="button"
            aria-pressed={option === range}
            onClick={() => {
              setRange(option);
              setHoveredIndex(null);
            }}
          >
            {option === "MAX" ? "Max" : option}
          </button>
        ))}
      </div>

      <div className="price-chart-wrap">
        <svg
          className="price-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${symbol} closing-price chart from ${points[0].tradingDate} to ${points.at(-1)!.tradingDate}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                className="chart-grid-line"
                x1={margin.left}
                x2={width - margin.right}
                y1={tick.y}
                y2={tick.y}
              />
              <text className="chart-axis-label" x={margin.left - 9} y={tick.y + 4}>
                {axisMoney.format(tick.value)}
              </text>
            </g>
          ))}

          <line
            className="chart-baseline"
            x1={margin.left}
            x2={width - margin.right}
            y1={yFor(points[0].close)}
            y2={yFor(points[0].close)}
          />
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <polyline
            fill="none"
            points={linePoints}
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          <line
            className="chart-cursor-line"
            x1={activeCoordinate.x}
            x2={activeCoordinate.x}
            y1={margin.top}
            y2={margin.top + plotHeight}
          />
          <circle
            cx={activeCoordinate.x}
            cy={activeCoordinate.y}
            r="5"
            fill={stroke}
            stroke="#ffffff"
            strokeWidth="3"
          />

          {xLabelIndexes.map((index) => (
            <text
              key={points[index].tradingDate}
              className="chart-axis-label chart-date-label"
              x={xFor(index)}
              y={height - 8}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            >
              {shortDate.format(dateValue(points[index].tradingDate))}
            </text>
          ))}
        </svg>
      </div>
      <p className="price-chart-note">
        Daily closing prices · dashed line marks the first close in this range
      </p>
    </section>
  );
}
