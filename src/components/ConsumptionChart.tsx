import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  value: number;
}

interface ConsumptionChartProps {
  data: DataPoint[];
}

export function ConsumptionChart({ data }: ConsumptionChartProps) {
  return (
    <div className="flex-1 min-h-0 w-full focus:outline-none" style={{ outline: 'none' }}>
      <ResponsiveContainer width="100%" height="100%" className="focus:outline-none" style={{ outline: 'none' }}>
        <AreaChart
          data={data}
          style={{ outline: "none" }}
          className="focus:outline-none"
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tickFormatter={(value) => `${value}W`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
            itemStyle={{ color: '#3b82f6' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
