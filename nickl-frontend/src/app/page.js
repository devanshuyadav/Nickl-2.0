"use client";

import { useState } from 'react';
import Uploader from '@/components/Uploader';
import DashboardSummary from '@/components/DashboardSummary';
import HoldingsGrid from '@/components/HoldingsGrid'; // <-- Add this import

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        <header className="mb-8 flex justify-between items-end border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nickl</h1>
            <p className="text-slate-500 mt-1">Real-time Portfolio Tracker</p>
          </div>
        </header>

        <section>
          <DashboardSummary refreshTrigger={refreshTrigger} />
        </section>

        {/* The New Holdings Grid */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Current Holdings</h2>
          <HoldingsGrid refreshTrigger={refreshTrigger} />
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Process Daily Contract Note</h2>
          <Uploader onUploadSuccess={handleUploadSuccess} />
        </section>

      </div>
    </main>
  );
}