'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Receipt, Loader2, Activity, ChevronDown, ChevronUp, PieChart, Check, RefreshCw } from 'lucide-react';
import StockChart from './StockChart';

export default function Dashboard() {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // 👈 NEW
    const [error, setError] = useState('');

    const [selectedStock, setSelectedStock] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [transactionsData, setTransactionsData] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [showGlobalCharges, setShowGlobalCharges] = useState(false);

    const [customTicker, setCustomTicker] = useState('');
    const [mapSuccess, setMapSuccess] = useState(false);

    // eslint-disable-next-line react-hooks/immutability
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
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        // Re-fetch portfolio data (and clear selection/transactions if desired)
        setSelectedStock(null);
        setTransactionsData([]);
        fetchPortfolio();
    };

    const handleRowClick = async (stock) => {
        if (selectedStock?.isin === stock.isin) {
            setSelectedStock(null);
            setMarketData(null);
            setTransactionsData([]);
            return;
        }

        setSelectedStock(stock);
        setCustomTicker('');
        setLoadingMarket(true);
        setLoadingTransactions(true);
        setTransactionsData([]);

        try {
            // Fetch chart data
            const chartRes = await fetch(`/api/market/chart/${stock.symbol}?days=30`);
            const chartData = await chartRes.json();
            if (!chartRes.ok) throw new Error(chartData.error || 'Failed to fetch historical chart data');
            setMarketData(chartData);

            const txRes = await fetch(`/api/portfolio/transactions/${stock.isin}`);
            const txData = await txRes.json();
            if (!txRes.ok) throw new Error(txData.error || 'Failed to fetch transactions');
            setTransactionsData(txData);

        } catch (err) {
            setMarketData({ error: err.message || 'Data unavailable.' });
        } finally {
            setLoadingMarket(false);
            setLoadingTransactions(false);
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
                    fetchPortfolio();
                    handleRowClick(selectedStock);
                }, 1500);
            }
        } catch (err) {
            console.error("Mapping failure", err);
        }
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (!portfolio) return null;

    const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const txSummary = transactionsData.reduce((acc, tx) => {
        if (tx.type === 'BUY') {
            acc.totalBuyQty += tx.quantity;
            acc.totalBuyValue += tx.netValue;
        } else {
            acc.totalSellQty += tx.quantity;
            acc.totalSellValue += tx.netValue;
        }
        return acc;
    }, { totalBuyQty: 0, totalBuyValue: 0, totalSellQty: 0, totalSellValue: 0 });

    const netQty = txSummary.totalBuyQty - txSummary.totalSellQty;
    const netInvested = txSummary.totalBuyValue - txSummary.totalSellValue;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="flex items-center"><Wallet className="h-4 w-4 mr-2" /> Current Invested</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">₹{portfolio.summary.totalInvested.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2 font-medium">Total money invested</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="flex items-center"><Wallet className="h-4 w-4 mr-2" /> Current Valudation</span>
                    </div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalCurrentValuation >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{portfolio.summary.totalCurrentValuation.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-2 font-medium">Portfolio Net worth based on LTP</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center text-gray-500 mb-2"><TrendingUp className="h-4 w-4 mr-2" /> Realized P&L</div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalRealizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalRealizedNetPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalRealizedNetPnL.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">In-hand Profit/Loss</div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center text-gray-500 mb-2"><Activity className="h-4 w-4 mr-2" /> Unrealized P&L</div>
                    <div className={`text-2xl font-bold ${portfolio.summary.totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio.summary.totalUnrealizedPnL >= 0 ? '+' : ''}₹{portfolio.summary.totalUnrealizedPnL.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">Based on live market prices</div>
                </div>

                {/* Total Charges (Interactive) */}
                {/* <div
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
                </div> */}
            </div>

            {/* Live Analysis Panel */}
            {selectedStock && (
                <div className="bg-linear-to-br from-blue-50 text-blue-900 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold flex items-center">
                                <PieChart className="h-6 w-6 mr-2 text-blue-600" /> {selectedStock.symbol}
                                <span className="ml-3 text-sm font-normal text-gray-900">{selectedStock.isin}</span>
                            </h2>
                        </div>
                        <button onClick={() => setSelectedStock(null)} className="text-blue-500 hover:text-blue-800 text-sm font-medium">Close Panel</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                        {/* Logic/Data Cards */}
                        <div className="space-y-4 lg:col-span-1 flex flex-col">

                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                                    <span className="text-gray-600">Realized P&L</span>
                                    <span className={`font-bold ${selectedStock.realizedNetPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedStock.realizedNetPnL > 0 ? '+' : ''}₹{selectedStock.realizedNetPnL.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Unrealized P&L</span>
                                    <span className={`font-bold ${selectedStock.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedStock.unrealizedPnL > 0 ? '+' : ''}₹{selectedStock.unrealizedPnL.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* REMOVED: Charges breakdown card */}
                            {/* Symbol Mapper Database Utility */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
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

                        {/* Right side: Chart + Transaction Table */}
                        <div className="lg:col-span-3 space-y-4">
                            {/* Chart */}
                            {/* <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100 relative min-h-[200px] flex flex-col">
                                <p className="text-sm font-bold text-gray-600 mb-2">30-Day Trend</p>
                                {loadingMarket ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <Loader2 className="animate-spin h-6 w-6 text-blue-500 mb-2" />
                                        <p className="text-xs font-medium text-gray-500">Loading charts...</p>
                                    </div>
                                ) : marketData?.error ? (
                                    <div className="flex flex-col items-center justify-center text-center px-4">
                                        <p className="text-red-500 text-sm font-medium mb-1">{marketData.error}</p>
                                        <p className="text-gray-500 text-xs">Use the Ticker Link tool to update the symbol mapping.</p>
                                    </div>
                                ) : marketData && marketData.chartData ? (
                                    <div>
                                        <StockChart data={marketData.chartData} symbol={selectedStock.symbol} />
                                    </div>
                                ) : null}
                            </div> */}

                            {/* Transaction History Table */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="font-bold text-gray-600">Transaction History</p>
                                    {loadingTransactions && <Loader2 className="animate-spin h-4 w-4 text-blue-500" />}
                                </div>

                                {/* Summary stats */}
                                {transactionsData.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50 p-3 rounded-md mb-3">
                                        <div><span className="text-gray-500">Avg. Price</span> <br /><span className="font-bold">{selectedStock.currentQuantity === 0 ? "N/A" : '₹ ' + selectedStock.averageBuyPrice.toFixed(2)}</span></div>
                                        <div><span className="text-gray-500">Current Holdings</span> <br /><span className="font-bold">{selectedStock.currentQuantity}</span></div>
                                        <div><span className="text-gray-500">Net Invested</span> <br /><span className="font-bold">{selectedStock.currentQuantity === 0 ? "N/A" : '₹ ' + netInvested.toFixed(2)}</span></div>
                                    </div>
                                )}

                                {/* Holdings Table */}
                                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                    {loadingTransactions ? (
                                        <p className="text-gray-500 text-center py-4">Loading transactions...</p>
                                    ) : transactionsData.length === 0 ? (
                                        <p className="text-gray-500 text-center py-4">No transactions found for this stock.</p>
                                    ) : (
                                        <table className="w-full text-left text-gray-600">
                                            <thead className="sticky top-0 bg-gray-100 text-sm text-gray-500 uppercase">
                                                <tr>
                                                    <th className="px-3 py-2">Type</th>
                                                    <th className="px-3 py-2">Date</th>
                                                    <th className="px-3 py-2 text-right">Qty</th>
                                                    <th className="px-3 py-2 text-right">Avg. Price</th>
                                                    <th className="px-3 py-2 text-right">Gross Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactionsData.map((tx, idx) => (
                                                    <tr key={idx} className="text-sm border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${tx.type === 'BUY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                                {tx.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.tradeDate)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{tx.quantity}</td>
                                                        <td className="px-3 py-2 text-right font-mono">₹{tx.price.toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">₹{tx.grossValue.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Holdings Table with Refresh Button */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Your Assets</h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <span className="text-xs text-gray-500 italic">Click any row for detailed analysis</span>
                    </div>
                </div>
                <div className="overflow-auto max-h-96">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">S. No.</th>
                                <th className="px-6 py-3">Symbol</th>
                                <th className="px-6 py-3 text-right">Invested</th>
                                <th className="px-6 py-3 text-right">Qty</th>
                                <th className="px-6 py-3 text-right">Avg. Price</th>
                                <th className="px-6 py-3 text-right">LTP</th>
                                <th className="px-6 py-3 text-right">Realized P&L</th>
                                <th className="px-6 py-3 text-right">Unrealized P&L</th>
                            </tr>
                        </thead>
                        <tbody>
                            {portfolio.holdings.map((stock, index) => (
                                <tr
                                    key={stock.isin}
                                    onClick={() => handleRowClick(stock)}
                                    className={`border-b cursor-pointer transition-colors ${selectedStock?.isin === stock.isin ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                >
                                    <td className="px-6 py-4 font-mono">{index + 1}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {stock.symbol}
                                        {selectedStock?.isin === stock.isin && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">₹{stock.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 text-right font-mono">{stock.currentQuantity}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹{stock.averageBuyPrice.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹{stock.livePrice.toFixed(2)}</td>
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