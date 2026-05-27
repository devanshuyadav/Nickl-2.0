'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Receipt, Loader2, Activity, ChevronDown, ChevronUp, PieChart } from 'lucide-react';
import StockChart from './StockChart';

export default function Dashboard() {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedStock, setSelectedStock] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [showGlobalCharges, setShowGlobalCharges] = useState(false);

    useEffect(() => { fetchPortfolio(); }, []);

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

    const handleRowClick = async (stock) => {
        if (selectedStock?.isin === stock.isin) {
            setSelectedStock(null);
            setMarketData(null);
            return;
        }
        setSelectedStock(stock);
        setLoadingMarket(true);

        try {
            const res = await fetch(`/api/market/chart/${stock.symbol}?days=30`);
            if (!res.ok) throw new Error('Failed to fetch historical chart data');
            const data = await res.json();
            setMarketData(data);
        } catch (err) {
            setMarketData({ error: 'Chart data unavailable right now.' });
        } finally {
            setLoadingMarket(false);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (!portfolio) return null;

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                {/* Invested & Valuation */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="flex items-center"><Wallet className="h-4 w-4 mr-2" /> Current Invested</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">₹{portfolio.summary.totalInvested.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2 font-medium">Valuation: ₹{portfolio.summary.totalCurrentValuation.toLocaleString()}</div>
                </div>

                {/* Realized P&L */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center text-gray-500 mb-2"><TrendingUp className="h-4 w-4 mr-2" /> Realized P&L</div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalRealizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalRealizedNetPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalRealizedNetPnL.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Locked-in profit/loss</div>
                </div>

                {/* Unrealized P&L */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center text-gray-500 mb-2"><Activity className="h-4 w-4 mr-2" /> Unrealized P&L</div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalUnrealizedPnL.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Based on live market prices</div>
                </div>

                {/* Total Charges (Interactive) */}
                <div
                    onClick={() => setShowGlobalCharges(!showGlobalCharges)}
                    className="bg-gray-900 p-5 rounded-xl border border-gray-800 shadow-sm text-white cursor-pointer hover:bg-black transition-colors flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between text-gray-400 mb-2">
                        <span className="flex items-center"><Receipt className="h-4 w-4 mr-2" /> All Extra Charges</span>
                        {showGlobalCharges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <div className="text-2xl font-bold">₹{portfolio.summary.charges.total.toLocaleString()}</div>

                    {showGlobalCharges ? (
                        <div className="mt-3 pt-3 border-t border-gray-700 text-xs space-y-2 text-gray-300">
                            <div className="flex justify-between"><span>Brokerage:</span> <span>₹{portfolio.summary.charges.brokerage.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>STT:</span> <span>₹{portfolio.summary.charges.stt.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>DP Charges:</span> <span>₹{portfolio.summary.charges.dpCharges.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Other:</span> <span>₹{portfolio.summary.charges.otherTaxes.toLocaleString()}</span></div>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 mt-2">Click to see exact breakdown</div>
                    )}
                </div>
            </div>

            {/* NEW: Live Analysis Panel (Expanded view for specific stock) */}
            {selectedStock && (
                <div className="bg-gradient-to-br from-blue-50 text-blue-900 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center">
                                <PieChart className="h-6 w-6 mr-2 text-blue-600" /> {selectedStock.symbol}
                            </h2>
                            <p className="text-sm opacity-80 mt-1">
                                Shares: {selectedStock.currentQuantity} | Avg Cost: ₹{selectedStock.averageBuyPrice.toFixed(2)} | Live Price: ₹{selectedStock.livePrice.toLocaleString()}
                            </p>
                        </div>
                        <button onClick={() => setSelectedStock(null)} className="text-blue-500 hover:text-blue-800 text-sm font-medium">Close Panel</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                        {/* The 3 Logic/Data Cards */}
                        <div className="space-y-4 lg:col-span-1">

                            {/* Realized & Unrealized Together */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                <p className="text-xs font-bold uppercase text-gray-500 mb-1">P&L Status</p>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                    <span className="text-sm text-gray-600">Realized:</span>
                                    <span className={`font-bold ${selectedStock.realizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedStock.realizedNetPnL > 0 ? '+' : ''}₹{selectedStock.realizedNetPnL.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Unrealized:</span>
                                    <span className={`font-bold ${selectedStock.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedStock.unrealizedPnL > 0 ? '+' : ''}₹{selectedStock.unrealizedPnL.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Specific Charges Breakdown */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                <p className="text-xs font-bold uppercase text-gray-500 mb-1">Total Fees Paid: ₹{selectedStock.chargesBreakdown.total.toFixed(2)}</p>
                                <div className="text-xs text-gray-600 space-y-1 mt-2">
                                    <div className="flex justify-between"><span>Brokerage:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.brokerage.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>STT:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.stt.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>DP Charges:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.dpCharges.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Other:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.otherTaxes.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* The Recharts Graph */}
                        <div className="lg:col-span-3 bg-white p-4 rounded-lg shadow-sm border border-blue-100 relative min-h-[200px]">
                            <p className="text-sm font-bold text-gray-600 mb-2">30-Day Trend</p>
                            {loadingMarket ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Loader2 className="animate-spin h-6 w-6 text-blue-500 mb-2" />
                                    <p className="text-xs font-medium text-gray-500">Loading charts...</p>
                                </div>
                            ) : marketData?.error ? (
                                <div className="text-red-500 text-center py-8 text-sm">{marketData.error}</div>
                            ) : marketData && (
                                <StockChart data={marketData.chartData} symbol={selectedStock.symbol} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Holdings Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Your Assets</h3>
                    <span className="text-xs text-gray-500 italic">Click any row for detailed analysis</span>
                </div>
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3">Symbol</th>
                            <th className="px-6 py-3 text-right">Qty</th>
                            <th className="px-6 py-3 text-right">Invested</th>
                            <th className="px-6 py-3 text-right">Realized P&L</th>
                            <th className="px-6 py-3 text-right">Unrealized P&L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {portfolio.holdings.map((stock) => (
                            <tr
                                key={stock.isin}
                                onClick={() => handleRowClick(stock)}
                                className={`border-b cursor-pointer transition-colors ${selectedStock?.isin === stock.isin ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {stock.symbol}
                                    {selectedStock?.isin === stock.isin && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                                </td>
                                <td className="px-6 py-4 text-right font-mono">{stock.currentQuantity}</td>
                                <td className="px-6 py-4 text-right">₹{stock.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                                {/* Realized */}
                                <td className={`px-6 py-4 text-right font-bold ${stock.realizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stock.realizedNetPnL > 0 ? '+' : ''}₹{stock.realizedNetPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* Unrealized (Calculated locally from the bulk live prices) */}
                                <td className={`px-6 py-4 text-right font-bold ${stock.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stock.unrealizedPnL > 0 ? '+' : ''}₹{stock.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}