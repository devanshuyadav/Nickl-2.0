'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Receipt, Loader2, Activity, ChevronDown, ChevronUp, PieChart, Check } from 'lucide-react';
import StockChart from './StockChart';

export default function Dashboard() {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Interactive Panel State
    const [selectedStock, setSelectedStock] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [showGlobalCharges, setShowGlobalCharges] = useState(false);

    // Symbol Mapping State
    const [customTicker, setCustomTicker] = useState('');
    const [mapSuccess, setMapSuccess] = useState(false);

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
        setCustomTicker(''); // Reset custom ticker input
        setLoadingMarket(true);

        try {
            const res = await fetch(`/api/market/chart/${stock.symbol}?days=30`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch historical chart data');
            setMarketData(data);
        } catch (err) {
            setMarketData({ error: err.message || 'Chart data unavailable right now.' });
        } finally {
            setLoadingMarket(false);
        }
    };

    const handleUpdateMapping = async () => {
        if (!customTicker) return;
        try {
            const res = await fetch('/api/portfolio/symbol-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdfSymbol: selectedStock.symbol, yahooSymbol: customTicker })
            });

            if (res.ok) {
                setMapSuccess(true);
                setTimeout(() => {
                    setMapSuccess(false);
                    fetchPortfolio(); // Reload dashboard to update live stats
                    handleRowClick(selectedStock); // Reload chart data for the new ticker
                }, 1500);
            }
        } catch (err) {
            console.error("Mapping failure", err);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (!portfolio) return null;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="flex items-center"><Wallet className="h-4 w-4 mr-2" /> Current Invested</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">₹{portfolio.summary.totalInvested.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2 font-medium">Valuation: ₹{portfolio.summary.totalCurrentValuation.toLocaleString()}</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center text-gray-500 mb-2"><TrendingUp className="h-4 w-4 mr-2" /> Realized P&L</div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalRealizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalRealizedNetPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalRealizedNetPnL.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Locked-in profit/loss</div>
                </div>

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
                            <div className="flex justify-between"><span>Other Taxes:</span> <span>₹{portfolio.summary.charges.otherTaxes.toLocaleString()}</span></div>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 mt-2">Click to see exact breakdown</div>
                    )}
                </div>
            </div>

            {/* Live Analysis Panel */}
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

                        {/* Logic/Data Cards */}
                        <div className="space-y-4 lg:col-span-1 flex flex-col">

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

                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                <p className="text-xs font-bold uppercase text-gray-500 mb-1">Total Fees: ₹{selectedStock.chargesBreakdown.total.toFixed(2)}</p>
                                <div className="text-xs text-gray-600 space-y-1 mt-2">
                                    <div className="flex justify-between"><span>Brokerage:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.brokerage.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>STT:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.stt.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>DP Charges:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.dpCharges.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Other:</span> <span className="font-medium">₹{selectedStock.chargesBreakdown.otherTaxes.toFixed(2)}</span></div>
                                </div>
                            </div>

                            {/* Symbol Mapper Database Utility */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex-grow">
                                <p className="text-xs font-bold uppercase text-gray-500 mb-2">Yahoo Ticker Link</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={selectedStock.yahooSymbol}
                                        value={customTicker}
                                        onChange={e => setCustomTicker(e.target.value)}
                                        className="border border-gray-300 p-2 text-xs rounded-md w-full uppercase focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleUpdateMapping}
                                        disabled={mapSuccess || !customTicker}
                                        className="bg-blue-600 text-white text-xs px-3 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center transition-colors"
                                    >
                                        {mapSuccess ? <Check className="h-4 w-4" /> : 'Save'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 leading-tight">Update if market data is missing or incorrect (e.g. RELIANCE.NS).</p>
                            </div>

                        </div>

                        {/* The Recharts Graph */}
                        <div className="lg:col-span-3 bg-white p-4 rounded-lg shadow-sm border border-blue-100 relative min-h-[300px] flex flex-col">
                            <p className="text-sm font-bold text-gray-600 mb-2">30-Day Trend</p>
                            {loadingMarket ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Loader2 className="animate-spin h-6 w-6 text-blue-500 mb-2" />
                                    <p className="text-xs font-medium text-gray-500">Loading charts...</p>
                                </div>
                            ) : marketData?.error ? (
                                <div className="flex flex-col items-center justify-center flex-grow text-center px-4">
                                    <p className="text-red-500 text-sm font-medium mb-1">{marketData.error}</p>
                                    <p className="text-gray-500 text-xs">Use the Ticker Link tool to update the symbol mapping.</p>
                                </div>
                            ) : marketData && marketData.chartData ? (
                                <div className="flex-grow">
                                    <StockChart data={marketData.chartData} symbol={selectedStock.symbol} />
                                </div>
                            ) : null}
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
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 min-w-[800px]">
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
                                    <td className={`px-6 py-4 text-right font-bold ${stock.realizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {stock.realizedNetPnL > 0 ? '+' : ''}₹{stock.realizedNetPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${stock.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {stock.unrealizedPnL > 0 ? '+' : ''}₹{stock.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}