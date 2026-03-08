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
  color?: string;
  className?: string;
  isAlert?: boolean;
}

export function MetricCard({ title, value, unit, icon: Icon, trend, color = "text-blue-500", className, isAlert }: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5 transition-all duration-300 group",
      isAlert
        ? "bg-red-500/20 backdrop-blur-xl border border-red-500/50 animate-pulse"
        : "bg-slate-900/50 backdrop-blur-xl border border-white/5 hover:border-white/10 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-blue-500/5",
      className
    )}>
      {/* Background Gradient Blob */}
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30",
        isAlert ? "bg-red-500" : color.replace('text-', 'bg-')
      )} />

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-2.5 rounded-xl border backdrop-blur-md",
            isAlert ? "bg-red-500/20 border-red-500/30 text-red-500" : cn("bg-slate-800/50 border-white/5", color)
          )}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
          {trend && !isAlert && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border border-white/5 bg-slate-800/50",
              trend === 'up' ? "text-emerald-400" :
                trend === 'down' ? "text-rose-400" : "text-blue-400"
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'stable' && '→'}
              <span className="hidden sm:inline">
                {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
              </span>
            </div>
          )}
          {isAlert && (
            <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border border-red-500/30 bg-red-500/20 text-red-500 animate-bounce">
              ALERT
            </div>
          )}
        </div>

        <div>
          <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-1", isAlert ? "text-red-300" : "text-slate-400")}>{title}</h3>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-2xl sm:text-3xl font-bold tracking-tight font-mono", isAlert ? "text-red-500" : "text-white")}>
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
            <span className={cn("font-medium text-sm", isAlert ? "text-red-400" : "text-slate-500")}>{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
