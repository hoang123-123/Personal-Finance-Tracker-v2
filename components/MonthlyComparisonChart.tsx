
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlyData } from '../types';

interface MonthlyComparisonChartProps {
  data: MonthlyData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-secondary p-4 rounded-lg shadow-lg border border-accent">
        <p className="label font-bold text-highlight">{`Tháng ${label}`}</p>
        <p className="text-green-400">{`Thu nhập: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[0].value)}`}</p>
        <p className="text-red-400">{`Chi tiêu: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[1].value)}`}</p>
      </div>
    );
  }

  return null;
};


const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({ data }) => {
  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg w-full h-96">
      <h3 className="text-xl font-bold mb-4 text-text-primary">Phân tích Thu-Chi Các Tháng</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
            <XAxis dataKey="month" stroke="#a0aec0" />
            <YAxis stroke="#a0aec0" tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(74, 85, 104, 0.5)' }}/>
            <Legend />
            <Bar dataKey="income" fill="#48bb78" name="Thu nhập" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#f56565" name="Chi tiêu" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full">
            <p className="text-text-secondary">Không có dữ liệu để hiển thị.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyComparisonChart;
