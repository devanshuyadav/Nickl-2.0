'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Receipt, Loader2, Activity } from 'lucide-react';
import StockChart from './StockChart';

export default function Dashboard() {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedStock, setSelectedStock] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [loadingMarket, setLoadingMarket] = useState(false);

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

    const handleRowClick = async (stock) => {
        // If clicking the same stock, close the panel
        if (selectedStock?.isin === stock.isin) {
            setSelectedStock(null);
            setMarketData(null);
            return;
        }

        setSelectedStock(stock);
        setLoadingMarket(true);

        try {
            // Fetch 30 days of historical data + live price
            const res = await fetch(`/api/market/chart/${stock.symbol}?days=30`);
            if (!res.ok) throw new Error('Failed to fetch market data');
            const data = await res.json();
            setMarketData(data);
        } catch (err) {
            console.error(err);
            // Fallback gracefully if Yahoo Finance fails
            setMarketData({ error: 'Market data unavailable right now.' });
        } finally {
            setLoadingMarket(false);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (!portfolio || portfolio.holdings.length === 0) return <div className="text-center mt-20 text-gray-500">No holdings found. Upload some trades!</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* Top Stat Cards (Realized metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* NEW: Live Analysis Panel */}
            {selectedStock && (
                <div className="bg-gradient-to-br from-blue-50 text-blue-900 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center">
                                <Activity className="h-6 w-6 mr-2 text-blue-600" />
                                {selectedStock.symbol} Analysis
                            </h2>
                            <p className="text-sm opacity-80 mt-1">Shares Owned: {selectedStock.currentQuantity} | Avg Cost: ₹{selectedStock.averageBuyPrice.toFixed(2)}</p>
                        </div>
                        <button onClick={() => setSelectedStock(null)} className="text-blue-400 hover:text-blue-700 text-sm font-medium">Close</button>
                    </div>

                    {loadingMarket ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-4" />
                            <p className="text-sm font-medium">Fetching live market data...</p>
                        </div>
                    ) : marketData?.error ? (
                        <div className="text-red-500 text-center py-8">{marketData.error}</div>
                    ) : marketData && (
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* Live Math Scoreboard */}
                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                                    <p className="text-xs font-bold uppercase text-gray-400">Live Market Price</p>
                                    <p className="text-3xl font-black text-gray-900">₹{marketData.livePrice.toLocaleString()}</p>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                                    <p className="text-xs font-bold uppercase text-gray-400">Current Valuation</p>
                                    <p className="text-xl font-bold text-gray-900">₹{(marketData.livePrice * selectedStock.currentQuantity).toLocaleString()}</p>
                                </div>

                                {/* THE UNREALIZED P&L CALCULATION */}
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                                    <p className="text-xs font-bold uppercase text-gray-400">Unrealized Net P&L</p>
                                    {(() => {
                                        const currentValuation = marketData.livePrice * selectedStock.currentQuantity;
                                        const unrealizedPnL = currentValuation - selectedStock.totalInvested;
                                        const isProfit = unrealizedPnL >= 0;
                                        return (
                                            <p className={`text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                                {isProfit ? '+' : ''}₹{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* The Recharts Graph */}
                            <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-blue-50">
                                <p className="text-sm font-bold text-gray-600 mb-2">30-Day Trend</p>
                                <StockChart data={marketData.chartData} symbol={selectedStock.symbol} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Holdings Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Your Assets</h3>
                    <span className="text-xs text-gray-500 italic">Click any row for live analysis</span>
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