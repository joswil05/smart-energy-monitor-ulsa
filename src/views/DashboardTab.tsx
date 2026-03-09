import React from 'react';
import { Zap, Activity, Gauge, Battery, Banknote } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import CountUp from 'react-countup';
import { ConsumptionChart } from '../components/ConsumptionChart';
import { calculateTotalCost } from '../hooks/billing';

export function DashboardTab({ metrics, currency, hourlyData, isOverload }: any) {
    return (
        <div className="flex flex-col h-full gap-2 md:gap-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <div className="col-span-2 lg:col-span-4 relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 group bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 border border-emerald-400 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/20 dark:shadow-[0_10px_30px_rgba(16,185,129,0.25)] hover:border-emerald-300 dark:hover:border-emerald-400/80">
                    <Banknote className="absolute -bottom-6 -right-4 w-40 h-40 text-emerald-900/10 dark:text-emerald-950/40 -rotate-12 pointer-events-none" strokeWidth={1} />
                    <div className="relative z-10 flex flex-col h-full justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-white/20 text-white backdrop-blur-sm">
                                <Banknote size={18} strokeWidth={2.5} className="opacity-100" />
                            </div>
                            <h3 className="text-[12px] font-bold uppercase tracking-widest text-emerald-50">
                                {currency === '$' ? "Costo Mensual Estimado" : "Costo Estimado (INE)"}
                            </h3>
                        </div>
                        <div className="flex items-baseline gap-1.5 px-1 py-1">
                            <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
                                <CountUp end={calculateTotalCost(metrics.energy, currency)} duration={0.8} decimals={2} separator="," preserveValue />
                            </span>
                            <span className="font-bold text-lg text-emerald-100">{currency}</span>
                        </div>
                    </div>
                </div>

                {/* Métricas Técnicas (2x2 Grid) */}
                <MetricCard title="Volt" value={metrics.voltage} unit="V" icon={Zap} colorClass="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" />
                <MetricCard title="Amp" value={metrics.current} unit="A" icon={Activity} colorClass="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" />
                <MetricCard title="Watts" value={metrics.power} unit="W" icon={Gauge} colorClass="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" isAlert={isOverload} />
                <MetricCard title="Energía" value={metrics.energy} unit="kWh" icon={Zap} colorClass="bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" />
            </div>
            {/* Gráfica de Consumo - Solid Style */}
            <div className="flex-1 bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] shadow-sm shadow-blue-900/5 dark:shadow-none rounded-2xl p-3 sm:p-4 flex flex-col pt-4 sm:pt-5 transition-colors duration-300 min-h-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <Activity size={18} strokeWidth={2.5} className="opacity-90" />
                        </div>
                        <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">Consumo</h2>
                    </div>
                    <select className="bg-[#F8FAFC] dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] text-[11px] font-semibold uppercase tracking-wider rounded-lg px-2.5 py-1.5 outline-none transition-colors">
                        <option>Últimas 24 Horas</option>
                        <option>Últimos 7 Días</option>
                        <option>Este Mes</option>
                    </select>
                </div>
                <ConsumptionChart data={hourlyData} />
            </div>
        </div>
    );
}
