"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';

// Indian Rupee formatter
const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
};

export default function DashboardSummary({ refreshTrigger }) {
    const [metrics, setMetrics] = useState({ totalInvested: 0, totalRealizedPnL: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get('http://localhost:5000/api/dashboard/portfolio');
                setMetrics(response.data.metrics);
            } catch (error) {
                console.error('Failed to fetch dashboard metrics', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPortfolio();
    }, [refreshTrigger]); // Re-runs whenever a new upload is successful

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-32 w-full text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const isProfit = metrics.totalRealizedPnL >= 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

            {/* Total Invested Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Active Investment</p>
                    <h3 className="text-3xl font-bold text-slate-900">
                        {formatINR(metrics.totalInvested)}
                    </h3>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                    <Wallet className="w-6 h-6" />
                </div>
            </div>

            {/* Realized P&L Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Realized P&L (Booked)</p>
                    <h3 className={`text-3xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}{formatINR(metrics.totalRealizedPnL)}
                    </h3>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isProfit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {isProfit ? <TrendingUp className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                </div>
            </div>

        </div>
    );
}