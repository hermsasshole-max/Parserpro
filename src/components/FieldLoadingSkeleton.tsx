import React from 'react';

interface FieldLoadingSkeletonProps {
  title?: string;
  rows?: number;
}

export const FieldLoadingSkeleton: React.FC<FieldLoadingSkeletonProps> = ({
  title = 'Loading Field Module...',
  rows = 4,
}) => {
  return (
    <div
      role="status"
      aria-label={title}
      className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse select-none"
    >
      {/* Module Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-850 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* KPI / Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2 shadow-xs"
          >
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-6 w-24 bg-slate-300 dark:bg-slate-700 rounded-md" />
            <div className="h-3 w-16 bg-slate-100 dark:bg-slate-850 rounded" />
          </div>
        ))}
      </div>

      {/* Data Table / List Skeleton */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden p-4 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 sm:w-48 bg-slate-300 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="h-4 w-20 bg-slate-300 dark:bg-slate-700 rounded ml-auto" />
                <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FieldLoadingSkeleton;
