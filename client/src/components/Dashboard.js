'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Receipt, Loader2 } from 'lucide-react';

export default function Dashboard() {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPortfolio();
    }, []);

    const fetchPortfolio = async () => {
        try {
            const res = await fetch('/api/portfolio');
            if (!res.ok) throw new Error('Failed to fetch portfolio data');
            const data = await res.json();
            setPortfolio(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (!portfolio || portfolio.holdings.length === 0) return <div className="text-center mt-20 text-gray-500">No holdings found. Upload some trades!</div>;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center text-gray-500 mb-2"><Wallet className="h-5 w-5 mr-2" /> Current Invested</div>
                    <div className="text-3xl font-bold text-gray-900">₹{portfolio.summary.totalInvested.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center text-gray-500 mb-2"><TrendingUp className="h-5 w-5 mr-2" /> Realized Net P&L</div>
                    <div className={`text-3xl font-bold ${portfolio.summary.totalRealizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalRealizedNetPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalRealizedNetPnL.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center text-gray-500 mb-2"><Receipt className="h-5 w-5 mr-2" /> Total Brokerage Paid</div>
                    <div className="text-3xl font-bold text-gray-900">₹{portfolio.summary.totalBrokeragePaid.toLocaleString()}</div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-800">Your Assets</h3>
                </div>
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3">Symbol</th>
                            <th className="px-6 py-3 text-right">Qty</th>
                            <th className="px-6 py-3 text-right">Avg Buy Price</th>
                            <th className="px-6 py-3 text-right">Total Invested</th>
                            <th className="px-6 py-3 text-right">Realized Net P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {portfolio.holdings.map((stock) => (
                            <tr key={stock.isin} className="border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{stock.symbol}</td>
                                <td className="px-6 py-4 text-right font-mono">{stock.currentQuantity}</td>
                                <td className="px-6 py-4 text-right">₹{stock.averageBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-6 py-4 text-right">₹{stock.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className={`px-6 py-4 text-right font-bold ${stock.realizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stock.realizedNetPnL > 0 ? '+' : ''}₹{stock.realizedNetPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}