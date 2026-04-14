"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import TransactionModal from './TransactionModal'; // Import the new modal

const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
};

export default function HoldingsGrid({ refreshTrigger }) {
    const [holdings, setHoldings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // State to track which stock is selected for the modal
    const [selectedStock, setSelectedStock] = useState(null);

    useEffect(() => {
        const fetchHoldings = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get('http://localhost:5000/api/dashboard/portfolio');
                setHoldings(response.data.holdings);
            } catch (error) {
                console.error('Failed to fetch holdings', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHoldings();
    }, [refreshTrigger]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (holdings.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-slate-500 font-medium">No holdings found.</p>
                <p className="text-sm text-slate-400 mt-1">Upload your first contract note to populate your dashboard.</p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                                <th className="p-4 font-semibold">Stock Symbol</th>
                                <th className="p-4 font-semibold text-right">Net Qty</th>
                                <th className="p-4 font-semibold text-right">Avg Buy Price</th>
                                <th className="p-4 font-semibold text-right">Invested Value</th>
                                <th className="p-4 font-semibold text-right">Realized P&L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {holdings.map((stock) => {
                                const isProfit = stock.realizedPnL > 0;
                                const isLoss = stock.realizedPnL < 0;

                                return (
                                    <tr
                                        key={stock.isin}
                                        // Make the row clickable
                                        onClick={() => setSelectedStock(stock)}
                                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                    >
                                        <td className="p-4 font-medium text-slate-900 group-hover:text-blue-700">
                                            {stock.symbol}
                                            <span className="block md:hidden text-xs text-slate-400 mt-1">Tap for details</span>
                                        </td>
                                        <td className="p-4 text-right text-slate-600 font-medium">
                                            {stock.currentQuantity}
                                        </td>
                                        <td className="p-4 text-right text-slate-600">
                                            {formatINR(stock.averageBuyPrice)}
                                        </td>
                                        <td className="p-4 text-right text-slate-900 font-medium">
                                            {formatINR(stock.totalInvested)}
                                        </td>
                                        <td className={`p-4 text-right font-bold ${isProfit ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-slate-500'}`}>
                                            {isProfit ? '+' : ''}{formatINR(stock.realizedPnL)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Render the modal conditionally if a stock is selected */}
            {selectedStock && (
                <TransactionModal
                    stock={selectedStock}
                    onClose={() => setSelectedStock(null)}
                />
            )}
        </>
    );
}