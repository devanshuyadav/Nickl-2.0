'use client';
import { useState } from 'react';
import { Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react';

export default function TradeTable({ initialData, onReset }) {
    // Store the trades in state so we can add/edit them before saving
    const [trades, setTrades] = useState(initialData.transactions || []);
    const [isExecuting, setIsExecuting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    // Form state for manually adding a missing trade
    const [newTrade, setNewTrade] = useState({
        tradeDate: new Date().toISOString().split('T')[0],
        isin: '',
        symbol: '',
        type: 'BUY',
        quantity: '',
        price: '',
        brokerage: 0,
        stt: 0,
        otherTaxes: 0,
        dpCharges: 0
    });

    const handleAddManualTrade = () => {
        if (!newTrade.isin || !newTrade.symbol || !newTrade.quantity || !newTrade.price) {
            return setError('Please fill out ISIN, Symbol, Quantity, and Price to add a manual trade.');
        }

        const qty = Number(newTrade.quantity);
        const price = Number(newTrade.price);
        const grossValue = qty * price;

        // Quick local calculation for the manual row's Net Value
        let netValue = 0;
        if (newTrade.type === 'BUY') {
            netValue = grossValue + Number(newTrade.brokerage) + Number(newTrade.stt) + Number(newTrade.otherTaxes);
        } else {
            netValue = grossValue - Number(newTrade.brokerage) - Number(newTrade.stt) - Number(newTrade.otherTaxes) - Number(newTrade.dpCharges);
        }

        const formattedTrade = {
            ...newTrade,
            quantity: qty,
            price: price,
            brokerage: Number(newTrade.brokerage),
            stt: Number(newTrade.stt),
            otherTaxes: Number(newTrade.otherTaxes),
            dpCharges: Number(newTrade.dpCharges),
            grossValue,
            netValue: Number(netValue.toFixed(2))
        };

        // Add it to the top of our table state
        setTrades([formattedTrade, ...trades]);
        setError('');

        // Reset manual form
        setNewTrade({ ...newTrade, isin: '', symbol: '', quantity: '', price: '' });
    };

    const removeTrade = (index) => {
        const updated = [...trades];
        updated.splice(index, 1);
        setTrades(updated);
    };

    const handleExecute = async () => {
        setIsExecuting(true);
        setError('');

        try {
            const response = await fetch('/api/upload/execute-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trades }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Execution failed');

            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsExecuting(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-md mx-auto mt-10 p-8 bg-green-50 text-green-800 rounded-xl text-center border border-green-200">
                <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Success!</h2>
                <p className="mb-6">Trades have been executed and saved to MongoDB.</p>
                <button onClick={onReset} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">
                    Upload Another Note
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Trade Confirmation Staging</h2>
                <button onClick={onReset} className="text-sm text-gray-500 hover:text-gray-800 underline">
                    Cancel & Go Back
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            {/* Manual Entry Form (For Missing Historical Trades) */}
            <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                    <Plus className="h-4 w-4 mr-1" /> Add Missing Historical Trade
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <input type="date" value={newTrade.tradeDate} onChange={e => setNewTrade({ ...newTrade, tradeDate: e.target.value })} className="p-2 border rounded" />
                    <input type="text" placeholder="ISIN" value={newTrade.isin} onChange={e => setNewTrade({ ...newTrade, isin: e.target.value.toUpperCase() })} className="p-2 border rounded" />
                    <input type="text" placeholder="Symbol" value={newTrade.symbol} onChange={e => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })} className="p-2 border rounded" />
                    <select value={newTrade.type} onChange={e => setNewTrade({ ...newTrade, type: e.target.value })} className="p-2 border rounded bg-white">
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                    </select>
                    <input type="number" placeholder="Quantity" value={newTrade.quantity} onChange={e => setNewTrade({ ...newTrade, quantity: e.target.value })} className="p-2 border rounded" />
                    <input type="number" placeholder="Price" value={newTrade.price} onChange={e => setNewTrade({ ...newTrade, price: e.target.value })} className="p-2 border rounded" />

                    <button onClick={handleAddManualTrade} className="md:col-span-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded">
                        Add to Queue
                    </button>
                </div>
            </div>

            {/* The Extracted Trades Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Symbol</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3 text-right">Qty</th>
                            <th className="px-4 py-3 text-right">Price</th>
                            <th className="px-4 py-3 text-right">Net Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trades.map((trade, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <button onClick={() => removeTrade(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                </td>
                                <td className="px-4 py-3">{new Date(trade.tradeDate).toISOString().split('T')[0]}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">{trade.symbol}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${trade.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">{trade.quantity}</td>
                                <td className="px-4 py-3 text-right">₹{trade.price.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">₹{trade.netValue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* The Final Commit Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleExecute}
                    disabled={isExecuting || trades.length === 0}
                    className="bg-gray-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-black disabled:bg-gray-400 flex items-center shadow-lg"
                >
                    {isExecuting ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Executing FIFO Engine...</> : 'Confirm & Execute Trades'}
                </button>
            </div>
        </div>
    );
}