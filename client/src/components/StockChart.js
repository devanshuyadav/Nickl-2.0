'use client';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function StockChart({ data, symbol }) {
    if (!data || data.length === 0) return null;

    // Find min and max for the Y-axis to make the chart look dynamic instead of flat
    const minPrice = Math.min(...data.map(d => d.price));
    const maxPrice = Math.max(...data.map(d => d.price));
    const padding = (maxPrice - minPrice) * 0.1;

    return (
        <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        domain={[minPrice - padding, maxPrice + padding]}
                        tickFormatter={(tick) => `₹${tick.toFixed(0)}`}
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={60}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`₹${value.toFixed(2)}`, 'Price']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#2563EB" // A clean, professional blue
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}