import React from 'react';
import { Zap, Activity, Gauge, Battery, Banknote } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { ConsumptionChart } from '../components/ConsumptionChart';
import { calculateTotalCost } from '../hooks/billing';

export function DashboardTab({ metrics, currency, hourlyData, isOverload }: any) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                <MetricCard title="Voltaje" value={metrics.voltage} unit="V" icon={Zap} color="text-yellow-500" trend="stable" />
                <MetricCard title="Corriente" value={metrics.current} unit="A" icon={Activity} color="text-blue-500" trend="up" />
                <MetricCard title="Potencia Real" value={metrics.power} unit="W" icon={Gauge} color="text-emerald-500" trend="up" isAlert={isOverload} />
                <MetricCard title="Factor Potencia" value={metrics.powerFactor} unit="PF" icon={Battery} color="text-purple-500" trend="stable" />
                <MetricCard title="Energía Total" value={metrics.energy} unit="kWh" icon={Zap} color="text-cyan-500" trend="up" />
                <MetricCard title={currency === '$' ? "Costo Estimado" : "Costo Estimado (INE)"} value={calculateTotalCost(metrics.energy, currency)} unit={currency} icon={Banknote} color="text-orange-500" trend="up" />
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">Consumo de Energía</h2>
                        <p className="text-sm text-slate-400">Estadísticas de uso (Últimas 24h)</p>
                    </div>
                    <select className="bg-slate-800 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Últimas 24 Horas</option>
                        <option>Últimos 7 Días</option>
                        <option>Últimos 30 Días</option>
                    </select>
                </div>
                <ConsumptionChart data={hourlyData} />
            </div>
        </div>
    );
}
