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
  colorClass?: string;
  className?: string;
  isAlert?: boolean;
}

export function MetricCard({ title, value, unit, icon: Icon, trend, colorClass = "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", className, isAlert }: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-3 transition-all duration-300 group",
      isAlert
        ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/50 animate-pulse"
        : "bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] shadow-sm shadow-blue-900/5 dark:shadow-none hover:border-slate-300 dark:hover:border-[#334155]",
      className
    )}>
      <div className="relative z-10 flex flex-col h-full justify-center">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "p-2 rounded-lg",
            isAlert ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" : colorClass
          )}>
            <Icon size={16} strokeWidth={2.5} className="opacity-90" />
          </div>
          <h3 className={cn("text-[11px] font-bold uppercase tracking-widest", isAlert ? "text-red-500 dark:text-red-400" : "text-[#64748B] dark:text-[#94A3B8]")}>{title}</h3>

          {trend && !isAlert && (
            <div className={cn(
              "ml-auto flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md",
              trend === 'up'
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                : trend === 'down'
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                  : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'stable' && '→'}
            </div>
          )}
          {isAlert && (
            <div className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 animate-bounce">
              ALERT
            </div>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-2xl sm:text-3xl font-bold tracking-tight", isAlert ? "text-red-600 dark:text-red-400" : "text-[#0F172A] dark:text-[#F1F5F9]")}>
              {typeof value === 'number' ? (
                <CountUp
                  end={value}
                  duration={0.8}
                  decimals={value % 1 !== 0 || title.includes("Costo") ? 2 : 0}
                  separator=","
                  preserveValue
                />
              ) : (
                value
              )}
            </span>
            <span className={cn("font-medium text-sm", isAlert ? "text-red-500 dark:text-red-400" : "text-[#64748B] dark:text-[#94A3B8]")}>{unit}</span>
          </div>
        </div>
      </div>
    </div >
  );
}
