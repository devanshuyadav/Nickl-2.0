'use client';
import { useState } from 'react';
import { CheckCircle, Loader2, PlusCircle } from 'lucide-react';

export default function TradeTable({ initialData, onReset }) {
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    // Wrap data in local state so we can append manual trades to it
    const [trades, setTrades] = useState(initialData.transactions || []);
    const [summary, setSummary] = useState(initialData.summary || {
        dailyTurnover: 0, totalBrokerage: 0, totalSTT: 0, totalDpCharges: 0, totalOtherTaxes: 0, finalNetCashFlow: 0
    });

    // Manual Trade Form State
    const [manualSymbol, setManualSymbol] = useState('');
    const [manualType, setManualType] = useState('BUY');
    const [manualQty, setManualQty] = useState('');
    const [manualPrice, setManualPrice] = useState('');

    // New Tax Form State
    const [manualBrokerage, setManualBrokerage] = useState('');
    const [manualSTT, setManualSTT] = useState('');
    const [manualDP, setManualDP] = useState('');
    const [manualOther, setManualOther] = useState('');

    const handleAddManualTrade = (e) => {
        e.preventDefault();
        if (!manualSymbol || !manualQty || !manualPrice) return;

        const qty = Math.abs(Number(manualQty));
        const price = Math.abs(Number(manualPrice));
        const grossValue = qty * price;

        // Default to 0 if left blank
        const brokerage = Math.abs(Number(manualBrokerage)) || 0;
        const stt = Math.abs(Number(manualSTT)) || 0;
        const dp = Math.abs(Number(manualDP)) || 0;
        const other = Math.abs(Number(manualOther)) || 0;

        // Calculate True Net Value mathematically based on B/S type
        let netValue = 0;
        if (manualType === 'BUY') {
            // Buying costs you the gross + all fees
            netValue = grossValue + brokerage + stt + dp + other;
        } else {
            // Selling gets you the gross - all fees
            netValue = grossValue - brokerage - stt - dp - other;
        }

        const newTrade = {
            isin: `${manualSymbol.toUpperCase()}_MANUAL`,
            symbol: manualSymbol.toUpperCase(),
            tradeDate: initialData.tradeDate,
            type: manualType,
            quantity: qty,
            price: price,
            grossValue: grossValue,
            brokerage: brokerage,
            stt: stt,
            dpCharges: dp,
            otherTaxes: other,
            netValue: netValue
        };

        setTrades([...trades, newTrade]);

        // Update global summary dynamically with the new charges!
        setSummary(prev => ({
            ...prev,
            dailyTurnover: prev.dailyTurnover + grossValue,
            totalBrokerage: prev.totalBrokerage + brokerage,
            totalSTT: prev.totalSTT + stt,
            totalDpCharges: prev.totalDpCharges + dp,
            totalOtherTaxes: (prev.totalOtherTaxes || 0) + other,
            finalNetCashFlow: prev.finalNetCashFlow + (manualType === 'SELL' ? netValue : -netValue)
        }));

        // Reset Form completely
        setManualSymbol(''); setManualQty(''); setManualPrice('');
        setManualBrokerage(''); setManualSTT(''); setManualDP(''); setManualOther('');
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        try {
            const payload = {
                tradeDate: initialData.tradeDate,
                summary: summary,
                transactions: trades
            };

            console.log("payload:", payload)

            const res = await fetch('/api/upload/execute-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save to database');

            setSaveStatus('success');
            setTimeout(() => { window.location.reload(); }, 1500);
        } catch (err) {
            console.error(err);
            alert('Failed to save trades. Check the console.');
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    if (saveStatus === 'success') {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-green-200 shadow-sm mt-10">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4 animate-bounce" />
                <h2 className="text-2xl font-bold text-gray-900">Trades Executed!</h2>
                <p className="text-gray-500 mt-2">Your FIFO ledger has been perfectly updated.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-6 pb-12">
            {/* Header Bar */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Review Extracted Trades</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Trade Date: <span className="font-mono font-medium text-gray-700">{new Date(initialData.tradeDate).toLocaleDateString()}</span>
                    </p>
                </div>
                <div className="flex space-x-3 w-full md:w-auto">
                    <button onClick={onReset} disabled={isSaving} className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={handleConfirm} disabled={isSaving} className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center transition-colors disabled:bg-blue-400">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                        Confirm & Save
                    </button>
                </div>
            </div>

            {/* Upgraded Summary Footer (6 Columns) */}
            <div className="bg-gray-900 text-white p-6 rounded-xl border border-gray-800 shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">Gross Turnover</p>
                    <p className="font-bold text-base">₹{summary.dailyTurnover.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">Brokerage</p>
                    <p className="font-medium text-red-400">-₹{summary.totalBrokerage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">STT</p>
                    <p className="font-medium text-red-400">-₹{summary.totalSTT.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">DP Charges</p>
                    <p className="font-medium text-red-400">-₹{summary.totalDpCharges.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">Other Taxes</p>
                    <p className="font-medium text-red-400">-₹{(summary.totalOtherTaxes || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="col-span-2 md:col-span-1 border-t border-gray-700 md:border-t-0 md:border-l md:pl-4 pt-4 md:pt-0">
                    <p className="text-gray-400 mb-1 text-[10px] uppercase tracking-wide">Net Cash Flow</p>
                    <p className={`font-bold text-lg ${summary.finalNetCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {summary.finalNetCashFlow > 0 ? '+' : ''}₹{summary.finalNetCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* The Expanded Trade Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 min-w-[1000px]">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-4">Symbol</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4 text-right">Qty</th>
                                <th className="px-4 py-4 text-right">Price</th>
                                <th className="px-4 py-4 text-right border-l border-gray-200">Gross Value</th>
                                <th className="px-4 py-4 text-right">Brokerage</th>
                                <th className="px-4 py-4 text-right">STT</th>
                                <th className="px-4 py-4 text-right">DP Chg</th>
                                <th className="px-4 py-4 text-right">Other</th>
                                <th className="px-4 py-4 text-right bg-gray-100 border-l border-gray-200 text-gray-900">Net Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((trade, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                        {trade.symbol}
                                        {trade.isin.includes('_MANUAL') && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">MANUAL</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${trade.type === 'BUY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                            {trade.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">{trade.quantity}</td>
                                    <td className="px-4 py-3 text-right font-mono">₹{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right text-gray-500 border-l border-gray-100">₹{trade.grossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right text-red-500 text-xs">{trade.brokerage > 0 ? `-₹${trade.brokerage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-500 text-xs">{trade.stt > 0 ? `-₹${trade.stt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-500 text-xs">{trade.dpCharges > 0 ? `-₹${trade.dpCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-500 text-xs">{trade.otherTaxes > 0 ? `-₹${trade.otherTaxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                    <td className="px-4 py-3 text-right font-bold bg-gray-50 border-l border-gray-100 text-gray-900">₹{trade.netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expanded Manual Entry Section */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm">
                <h3 className="text-blue-900 font-bold mb-4 flex items-center">
                    <PlusCircle className="h-5 w-5 mr-2 text-blue-600" />
                    Add Missing Historical Trade
                </h3>
                <form onSubmit={handleAddManualTrade} className="space-y-4">

                    {/* Row 1: The Core Math */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1">Symbol</label>
                            <input type="text" placeholder="e.g. RELIANCE" value={manualSymbol} onChange={e => setManualSymbol(e.target.value)} className="w-full border border-blue-200 rounded p-2 text-sm uppercase focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1">Type</label>
                            <select value={manualType} onChange={e => setManualType(e.target.value)} className="w-full border border-blue-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1">Quantity</label>
                            <input type="number" placeholder="0" min="1" value={manualQty} onChange={e => setManualQty(e.target.value)} className="w-full border border-blue-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-1">Avg Price (₹)</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0.01" value={manualPrice} onChange={e => setManualPrice(e.target.value)} className="w-full border border-blue-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                    </div>

                    {/* Row 2: The Taxes & Submit */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2 border-t border-blue-100">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Brokerage (₹)</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" value={manualBrokerage} onChange={e => setManualBrokerage(e.target.value)} className="w-full border border-blue-200 rounded p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">STT (₹)</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" value={manualSTT} onChange={e => setManualSTT(e.target.value)} className="w-full border border-blue-200 rounded p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">DP Charges (₹)</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" value={manualDP} onChange={e => setManualDP(e.target.value)} className="w-full border border-blue-200 rounded p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Other Taxes (₹)</label>
                            <input type="number" placeholder="0.00" step="0.01" min="0" value={manualOther} onChange={e => setManualOther(e.target.value)} className="w-full border border-blue-200 rounded p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div className="flex items-end">
                            <button type="submit" className="w-full bg-blue-600 text-white rounded p-1.5 text-sm font-bold tracking-wide hover:bg-blue-700 transition-colors h-[34px]">
                                Add to Ledger
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            
        </div>
    );
}