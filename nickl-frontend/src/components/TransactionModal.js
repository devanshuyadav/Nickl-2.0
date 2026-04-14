"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';

const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(amount);
};

export default function TransactionModal({ stock, onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/dashboard/transactions/${stock.isin}`);
                setTransactions(response.data.transactions);
            } catch (error) {
                console.error('Failed to fetch transactions', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (stock?.isin) fetchTransactions();
    }, [stock]);

    // Prevent clicks inside the modal from closing it
    const handleModalClick = (e) => e.stopPropagation();

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose} // Clicking the background closes the modal
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={handleModalClick}
            >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{stock.symbol}</h3>
                        <p className="text-sm text-slate-500">Transaction History</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No transactions found.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white shadow-sm z-10">
                                <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                    <th className="p-4 font-semibold">Date</th>
                                    <th className="p-4 font-semibold">Type</th>
                                    <th className="p-4 font-semibold text-right">Qty</th>
                                    <th className="p-4 font-semibold text-right">Price</th>
                                    <th className="p-4 font-semibold text-right">Total Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {transactions.map((tx) => (
                                    <tr key={tx._id} className="hover:bg-slate-50">
                                        <td className="p-4 text-slate-700 whitespace-nowrap">
                                            {new Date(tx.tradeDate).toLocaleDateString('en-IN', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${tx.type === 'BUY'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-medium text-slate-700">
                                            {tx.quantity}
                                        </td>
                                        <td className="p-4 text-right text-slate-600">
                                            {formatINR(tx.price)}
                                        </td>
                                        <td className="p-4 text-right font-medium text-slate-900">
                                            {formatINR(tx.totalValue)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}