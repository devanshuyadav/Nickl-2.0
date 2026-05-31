'use client';
import { useState } from 'react';
import { AlertTriangle, Trash2, Loader2, Info } from 'lucide-react';

export default function Settings({ onResetSuccess }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const handleReset = async () => {
        const confirmed = window.confirm("🚨 WARNING: Are you absolutely sure?\n\nThis will permanently delete ALL transactions and holdings from your database. This action cannot be undone.");
        if (!confirmed) return;

        setIsDeleting(true);
        setError('');

        try {
            const res = await fetch('/api/portfolio/reset', { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to wipe database');

            // Briefly wait to show the loading state, then trigger success
            setTimeout(() => {
                setIsDeleting(false);
                onResetSuccess();
            }, 800);

        } catch (err) {
            setError(err.message);
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    System Settings
                </h2>
                <div className="flex items-start p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                    <Info className="h-5 w-5 mr-3 mt-0.5 shrink-0" />
                    <p className="text-sm">
                        Symbol mappings (your Yahoo Finance ticker links) are stored in a separate database collection. Wiping your portfolio data will <strong>not</strong> delete your custom ticker mappings.
                    </p>
                </div>
            </div>

            {/* The Danger Zone */}
            <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
                <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" /> Danger Zone
                </h3>
                <p className="text-sm text-red-700 mb-6">
                    This will instantly wipe your entire FIFO ledger. All historical trades, calculated P&L, and asset allocations will be permanently erased. Use this strictly for testing and resetting your state.
                </p>

                {error && <div className="mb-4 text-sm text-red-600 font-bold">{error}</div>}

                <button
                    onClick={handleReset}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-sm flex items-center transition-colors disabled:bg-red-400"
                >
                    {isDeleting ? (
                        <><Loader2 className="animate-spin h-5 w-5 mr-2" /> NUKING DATABASE...</>
                    ) : (
                        <><Trash2 className="h-5 w-5 mr-2" /> Wipe All Portfolio Data</>
                    )}
                </button>
            </div>

        </div>
    );
}