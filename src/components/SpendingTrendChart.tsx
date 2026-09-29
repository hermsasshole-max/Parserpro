import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine,
  Dot
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Layers,
  Activity
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import { 
  calculateSixMonthSpendingTrend, 
  MonthSpendingTrendPoint 
} from '../utils/reportUtils';

interface SpendingTrendChartProps {
  receipts: SavedReceipt[];
  monthA: string;
  monthB: string;
  onSelectMonthA: (month: string) => void;
  onSelectMonthB: (month: string) => void;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  receipts,
  monthA,
  monthB,
  onSelectMonthA,
  onSelectMonthB,
}) => {
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [showAverageLine, setShowAverageLine] = useState<boolean>(true);

  // Calculate 6-month trend ending with the latest recorded month
  const trendSummary = useMemo(() => {
    return calculateSixMonthSpendingTrend(receipts);
  }, [receipts]);

  const {
    points,
    totalSixMonthSpend,
    averageMonthlySpend,
    highestMonth,
    lowestMonth,
    percentChangeLatestVsAvg,
    percentChangeLatestVsPrev,
  } = trendSummary;

  const latestPoint = points[points.length - 1];
  const isSpendingBelowAvg = percentChangeLatestVsAvg <= 0;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: MonthSpendingTrendPoint = payload[0].payload;
      const isA = data.monthKey === monthA;
      const isB = data.monthKey === monthB;
      const diffFromAvg = data.totalSpend - averageMonthlySpend;
      const pctFromAvg = averageMonthlySpend > 0 ? (diffFromAvg / averageMonthlySpend) * 100 : 0;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2 pointer-events-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              {data.fullLabel}
            </span>
            <div className="flex items-center gap-1">
              {isA && (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[9px] rounded border border-emerald-400/30">
                  Month A
                </span>
              )}
              {isB && (
                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 font-bold text-[9px] rounded border border-blue-400/30">
                  Month B
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Total Spending
            </div>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              R {data.totalSpend.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Receipts:</span>
              <span className="font-semibold text-slate-200">{data.receiptCount} filed</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Line Items:</span>
              <span className="font-semibold text-slate-200">{data.itemCount} items</span>
            </div>
          </div>

          {data.topCategory !== 'None' && (
            <div className="pt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-400">Top Spend: </span>
              <span className="font-semibold text-slate-200">{data.topCategory}</span>
            </div>
          )}

          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">vs 6-Mo Average:</span>
            <span className={`font-bold ${pctFromAvg <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {pctFromAvg <= 0 ? '-' : '+'}{Math.abs(pctFromAvg).toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Customized Dot to highlight selected Month A and Month B
  const renderCustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;

    const isA = payload.monthKey === monthA;
    const isB = payload.monthKey === monthB;

    if (isA) {
      return (
        <g key={`dot-${payload.monthKey}`}>
          <circle cx={cx} cy={cy} r={8} fill="#059669" fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={5} fill="#059669" stroke="#ffffff" strokeWidth={2} />
        </g>
      );
    }

    if (isB) {
      return (
        <g key={`dot-${payload.monthKey}`}>
          <circle cx={cx} cy={cy} r={8} fill="#2563eb" fillOpacity={0.25} />
          <circle cx={cx} cy={cy} r={5} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
        </g>
      );
    }

    return (
      <circle
        key={`dot-${payload.monthKey}`}
        cx={cx}
        cy={cy}
        r={3.5}
        fill="#059669"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              6-Month Spending Trend History
            </h3>
            <span className="hidden md:inline-block text-[11px] text-slate-400">
              · Continuous financial trajectory
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Track household expenditure fluctuations and savings habits across the last 6 months.
          </p>
        </div>

        {/* Chart View Toggles */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setShowAverageLine(!showAverageLine)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showAverageLine 
                ? 'bg-slate-100 border-slate-300 text-slate-800' 
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
            title="Toggle 6-month average reference line"
          >
            <span className="w-2.5 h-0.5 bg-slate-400 inline-block border-b border-dashed border-slate-600"></span>
            <span>Avg Baseline</span>
          </button>

          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Gradient Area
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                chartType === 'line'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Line Only
            </button>
          </div>
        </div>
      </div>

      {/* 4 Key Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: 6-Month Total */}
        <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>6-Month Total Spend</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
            R {totalSixMonthSpend.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Across {points.length} consecutive calendar months
          </div>
        </div>

        {/* Card 2: 6-Month Monthly Average */}
        <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Monthly Average</span>
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
            R {averageMonthlySpend.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Target benchmark baseline
          </div>
        </div>

        {/* Card 3: Highest Spend Month */}
        <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span>Peak Spending Month</span>
            <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono truncate">
            {highestMonth ? `R ${highestMonth.totalSpend.toFixed(0)}` : 'R 0'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {highestMonth ? highestMonth.fullLabel : 'None'}
          </div>
        </div>

        {/* Card 4: Momentum / Variance */}
        <div className={`p-3 rounded-xl border ${
          isSpendingBelowAvg 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
            : 'bg-rose-50/70 border-rose-200 text-rose-950'
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 flex items-center justify-between">
            <span>Latest Trajectory</span>
            {isSpendingBelowAvg ? (
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            )}
          </div>
          <div className="text-lg sm:text-xl font-black mt-1 flex items-center gap-1 font-mono">
            <span>
              {isSpendingBelowAvg ? '-' : '+'}{Math.abs(percentChangeLatestVsAvg)}%
            </span>
          </div>
          <div className="text-[10px] font-semibold mt-0.5">
            {isSpendingBelowAvg ? (
              <span className="text-emerald-700">Below 6-mo average (Saving)</span>
            ) : (
              <span className="text-rose-700">Above 6-mo baseline</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Recharts Area / Line Chart */}
      <div className="w-full pt-1 pb-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart
                data={points}
                margin={{ top: 14, right: 16, left: -10, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="spendGradientEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showAverageLine && averageMonthlySpend > 0 && (
                  <ReferenceLine
                    y={averageMonthlySpend}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Avg R ${averageMonthlySpend.toFixed(0)}`,
                      position: 'insideTopRight',
                      fill: '#64748b',
                      fontSize: 10,
                      fontWeight: 700
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="totalSpend"
                  name="Monthly Spend"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#spendGradientEmerald)"
                  activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                  dot={renderCustomDot}
                />
              </AreaChart>
            ) : (
              <LineChart
                data={points}
                margin={{ top: 14, right: 16, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#64748b"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R ${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {showAverageLine && averageMonthlySpend > 0 && (
                  <ReferenceLine
                    y={averageMonthlySpend}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Avg R ${averageMonthlySpend.toFixed(0)}`,
                      position: 'insideTopRight',
                      fill: '#64748b',
                      fontSize: 10,
                      fontWeight: 700
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="totalSpend"
                  name="Monthly Spend"
                  stroke="#059669"
                  strokeWidth={2.5}
                  activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                  dot={renderCustomDot}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive 6-Month Timeline Selector Strip */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-semibold text-slate-600">Quick-Select Comparison Period:</span>
          <span className="text-[11px] text-slate-400">
            Click to set as <strong className="text-emerald-700">Month A</strong> or <strong className="text-blue-700">Month B</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {points.map((p) => {
            const isA = p.monthKey === monthA;
            const isB = p.monthKey === monthB;

            return (
              <div
                key={p.monthKey}
                className={`p-2 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                  isA 
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20' 
                    : isB
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{p.shortLabel}</span>
                  {isA && (
                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded">
                      Month A
                    </span>
                  )}
                  {isB && (
                    <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
                      Month B
                    </span>
                  )}
                </div>

                <div className="mt-1 font-mono font-bold text-slate-900 text-[11px]">
                  R {p.totalSpend.toFixed(0)}
                </div>

                <div className="text-[10px] text-slate-400">
                  {p.receiptCount} receipts
                </div>

                {/* Quick Selection Buttons */}
                <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between gap-1 text-[10px]">
                  <button
                    onClick={() => onSelectMonthA(p.monthKey)}
                    className={`flex-1 py-0.5 rounded font-bold transition-colors cursor-pointer text-center ${
                      isA ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    title={`Set ${p.shortLabel} as Month A (Primary)`}
                  >
                    Set A
                  </button>
                  <button
                    onClick={() => onSelectMonthB(p.monthKey)}
                    className={`flex-1 py-0.5 rounded font-bold transition-colors cursor-pointer text-center ${
                      isB ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    title={`Set ${p.shortLabel} as Month B (Comparison)`}
                  >
                    Set B
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
