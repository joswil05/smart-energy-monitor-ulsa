import React from 'react';
import { LucideIcon } from 'lucide-react';
import CountUp from 'react-countup';
import { cn } from '../lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
  subtitleType?: 'success' | 'warning' | 'alert' | 'neutral';
  colorClass?: string;
  className?: string;
  isAlert?: boolean;
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  subtitle,
  subtitleType = 'neutral',
  className,
  isAlert
}: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3.5 sm:p-4 min-h-[105px] sm:min-h-[114px] flex flex-col justify-between transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out group",
      isAlert
        ? "bg-red-500/10 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
        : "bg-white dark:bg-[#0E1422] border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 hover:border-blue-400/80 dark:hover:border-blue-500/50 hover:scale-[1.005]",
      className
    )}>
      <div className="relative z-10 flex flex-col h-full justify-between gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-xl transition-colors duration-150",
              isAlert
                ? "bg-red-500/20 text-red-600 dark:text-red-400"
                : "bg-slate-100 dark:bg-[#131A2B] text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            )}>
              <Icon size={16} strokeWidth={2.2} />
            </div>
            <h3 className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              isAlert ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
            )}>
              {title}
            </h3>
          </div>

          {trend && !isAlert && (
            <div className={cn(
              "flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
              trend === 'up'
                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                : trend === 'down'
                  ? "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                  : "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'stable' && '→'}
            </div>
          )}

          {isAlert && (
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              ALERTA
            </div>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={cn(
              "text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums",
              isAlert ? "text-red-600 dark:text-red-400" : "text-[#0F172A] dark:text-[#F1F5F9]"
            )}>
              {typeof value === 'number' ? (
                <CountUp
                  end={value}
                  duration={0.8}
                  decimals={value % 1 !== 0 || title.includes("Costo") || title.includes("Factor") ? 2 : 0}
                  separator=","
                  preserveValue
                />
              ) : (
                value
              )}
            </span>
            <span className={cn(
              "font-semibold text-xs font-mono",
              isAlert ? "text-red-500 dark:text-red-400" : "text-[#64748B] dark:text-[#94A3B8]"
            )}>
              {unit}
            </span>
          </div>

          {subtitle && (
            <p className={cn(
              "text-[10px] font-medium mt-0.5 truncate",
              subtitleType === 'success' && "text-emerald-600 dark:text-emerald-400",
              subtitleType === 'warning' && "text-amber-600 dark:text-amber-400",
              subtitleType === 'alert' && "text-red-600 dark:text-red-400",
              subtitleType === 'neutral' && "text-[#64748B] dark:text-[#94A3B8]"
            )}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
