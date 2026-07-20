'use client';
import { useState, useEffect } from 'react';
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
    const [manualDate, setManualDate] = useState('');

    // Initialize with today's date when component mounts
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setManualDate(today);
    }, []);

    const handleAddManualTrade = (e) => {
        e.preventDefault();
        if (!manualSymbol || !manualQty || !manualPrice || !manualDate) return;

        const qty = Math.abs(Number(manualQty));
        const price = Math.abs(Number(manualPrice));
        const grossValue = qty * price;
        const netValue = grossValue; // no fees

        const newTrade = {
            isin: `${manualSymbol.toUpperCase()}_MANUAL`,
            symbol: manualSymbol.toUpperCase(),
            tradeDate: manualDate,
            type: manualType,
            quantity: qty,
            price: price,
            grossValue: grossValue,
            netValue: netValue,
            brokerage: 0,
            stt: 0,
            dpCharges: 0,
            otherTaxes: 0,
        };

        setTrades([...trades, newTrade]);

        // Update global summary dynamically (only turnover and net cash flow)
        setSummary(prev => ({
            ...prev,
            dailyTurnover: prev.dailyTurnover + grossValue,
            finalNetCashFlow: prev.finalNetCashFlow + (manualType === 'SELL' ? netValue : -netValue)
        }));

        // Reset form completely
        setManualSymbol(''); setManualQty(''); setManualPrice('');
        setManualType('BUY');
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

            const responseData = await res.json();

            if (!res.ok) {
                if (res.status === 400 && responseData.error) {
                    if (responseData.details && responseData.details.length > 0) {
                        alert(`❌ ${responseData.error}\n\n${responseData.details.join('\n')}`);
                    } else {
                        alert(responseData.error);
                    }
                    setIsSaving(false);
                    return;
                }

                // Handle duplicate (409)
                if (res.status === 409) {
                    alert(responseData.error);
                    setIsSaving(false);
                    return;
                }

                throw new Error(responseData.error || 'Failed to save to database');
            }

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

    const formatDateToDDMMYY = (date) => {
        const d = new Date(date);
        if (isNaN(d)) return 'Invalid date';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
    };

    return (
        <div className="space-y-6 mt-6 pb-12">
            {/* Header Bar */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Review Extracted Trades</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Trade Date: <span className="font-mono font-medium text-gray-700">{formatDateToDDMMYY(initialData.tradeDate)}</span>
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

            {/* Upgraded Summary Table */}
            <div className="bg-gray-900 text-white p-6 rounded-xl border border-gray-800 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <tbody>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">Pay In / Pay Out Obligation</td>
                            <td className="py-2.5 text-right font-bold">
                                ₹{summary.dailyTurnover.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">Taxable Value of Supply (Brokerage) </td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.totalBrokerage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">Exchange Transaction Charges</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.exchangeTransactionCharges?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">CGST</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.cgst?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">SGST</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.sgst?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">IGST</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.igst?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">UTT</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.utt?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">Securities Transaction Tax</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.stt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">SEBI Turnover Fees</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.sebiFees?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">Stamp Duty</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.stampDuty?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">IPFT Charges</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.ipft?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-3 text-gray-300 font-semibold">Net amount Receivable / Payable by client</td>
                            <td className="py-3 text-right font-bold text-lg">
                                <span className={summary.netAmountReceivablePayable >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {summary.netAmountReceivablePayable > 0 ? '+ ' : ''}
                                    ₹{summary.netAmountReceivablePayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="border-b border-gray-700">
                            <td className="py-2.5 text-gray-400 font-medium">DP Charges</td>
                            <td className="py-2.5 text-right text-red-400 font-medium">
                                -₹{summary.dp?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                            </td>
                        </tr>
                        <tr className="border-t-2 border-gray-600">
                            <td className="py-3 text-gray-300 font-semibold">Net Cash Flow</td>
                            <td className="py-3 text-right font-bold text-lg">
                                <span className={summary.finalNetCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {summary.finalNetCashFlow > 0 ? '+ ' : ''}
                                    ₹{summary.finalNetCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* The Expanded Trade Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600 min-w-[700px]">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-4">Symbol</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4 text-right">Qty</th>
                                <th className="px-4 py-4 text-right">Price</th>
                                <th className="px-4 py-4 text-right border-l border-gray-200">Gross Value</th>
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
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${trade.type === 'BUY' ? 'bg-blue-100 text-gray-800' : 'bg-purple-100 text-purple-800'}`}>
                                            {trade.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">{trade.quantity}</td>
                                    <td className="px-4 py-3 text-right font-mono">₹{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right text-gray-500 border-l border-gray-100">₹{trade.grossValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right font-bold bg-gray-50 border-l border-gray-100 text-gray-900">₹{trade.netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Entry Section with Date */}
            <div className="text-gray-900 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-gray-900 font-bold mb-4 flex items-center">
                    <PlusCircle className="h-5 w-5 mr-2 text-gray-600" />
                    Add Missing Historical Trade
                </h3>
                <form onSubmit={handleAddManualTrade} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-800 mb-1">Symbol</label>
                            <input
                                type="text"
                                placeholder="e.g. RELIANCE"
                                value={manualSymbol}
                                onChange={e => setManualSymbol(e.target.value)}
                                className="w-full border border-gray-200 rounded p-2 text-sm uppercase focus:ring-blue-500 focus:border-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-800 mb-1">Type</label>
                            <select
                                value={manualType}
                                onChange={e => setManualType(e.target.value)}
                                className="w-full border border-gray-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-gray-500 bg-white"
                            >
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-800 mb-1">Quantity</label>
                            <input
                                type="number"
                                placeholder="0"
                                min="1"
                                value={manualQty}
                                onChange={e => setManualQty(e.target.value)}
                                className="w-full border border-gray-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-800 mb-1">Price (₹)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                                value={manualPrice}
                                onChange={e => setManualPrice(e.target.value)}
                                className="w-full border border-gray-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-800 mb-1">Trade Date</label>
                            <input
                                type="date"
                                value={manualDate}
                                onChange={e => setManualDate(e.target.value)}
                                className="w-full border border-gray-200 rounded p-2 text-sm focus:ring-blue-500 focus:border-gray-500"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold tracking-wide hover:bg-blue-700 transition-colors"
                        >
                            Add to Ledger
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}