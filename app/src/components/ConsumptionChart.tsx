import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: string;
  value: number;
}

interface ConsumptionChartProps {
  data: DataPoint[];
  darkMode?: boolean;
}

export function ConsumptionChart({ data, darkMode = true }: ConsumptionChartProps) {
  const gridStroke = darkMode ? '#1E293B' : '#E2E8F0';
  const textStroke = darkMode ? '#94A3B8' : '#64748B';
  const primaryStroke = darkMode ? '#3B82F6' : '#1D4ED8';

  return (
    <div className="flex-1 min-h-[200px] sm:min-h-[240px] w-full focus:outline-none select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 20,
            left: -10,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryStroke} stopOpacity={darkMode ? 0.35 : 0.2} />
              <stop offset="95%" stopColor={primaryStroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="time"
            stroke={textStroke}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            className="font-mono tabular-nums"
          />
          <YAxis
            stroke={textStroke}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value) => `${value}W`}
            className="font-mono tabular-nums"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: darkMode ? '#0E1422' : '#FFFFFF',
              borderColor: darkMode ? '#1E293B' : '#E2E8F0',
              color: darkMode ? '#F8FAFC' : '#0F172A',
              borderRadius: '12px',
              boxShadow: darkMode
                ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                : '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
              fontSize: '12px',
              fontWeight: '600'
            }}
            itemStyle={{ color: primaryStroke }}
            labelStyle={{ color: darkMode ? '#94A3B8' : '#64748B', marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={primaryStroke}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
