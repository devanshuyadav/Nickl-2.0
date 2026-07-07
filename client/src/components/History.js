'use client';
import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';

export default function History() {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/contract-notes');
            console.log('on frontend:', res)
            if (!res.ok) throw new Error('Failed to fetch contract notes');
            const data = await res.json();
            setNotes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
    if (error) return <div className="text-red-500 text-center mt-20">{error}</div>;
    if (notes.length === 0) return (
        <div className="flex flex-col items-center justify-center mt-20 text-gray-500">
            <FileText className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No contract notes uploaded yet.</p>
            <p className="text-sm">Upload a PDF via the &quot;Upload Trades&quot; tab to get started.</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto mt-6 pb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                Uploaded Contract Notes
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-gray-900 text-sm">
                        <thead className="bg-gray-50 uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4 text-left">Trade Date</th>
                                <th className="px-6 py-4 text-right">Turnover</th>
                                <th className="px-6 py-4 text-right">Brokerage</th>
                                <th className="px-6 py-4 text-right">STT</th>
                                <th className="px-6 py-4 text-right">DP Charges</th>
                                <th className="px-6 py-4 text-right">Other Taxes</th>
                                <th className="px-6 py-4 text-right font-semibold text-gray-700">Net Cash Flow</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notes.map((note) => (
                                <tr key={note.tradeDate} className="border-b hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{formatDate(note.tradeDate)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹ {note.dailyTurnover.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹ {note.totalBrokerage.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹ {note.totalSTT.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹ {note.totalDPCharge.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono">₹ {note.totalOtherTaxes.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold">
                                        <span className={note.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            ₹ {note.netCashFlow.toFixed(2)}
                                        </span>
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