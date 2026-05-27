'use client';
import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import TradeTable from '@/components/TradeTable';
import Dashboard from '@/components/Dashboard';
import Settings from '@/components/Settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'upload', or 'settings'
  const [extractedData, setExtractedData] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header & Navigation */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Portfolio Engine</h1>
            <p className="mt-2 text-sm text-gray-500">True fully-loaded FIFO execution tracking.</p>
          </div>

          {/* Updated 3-Button Navigation */}
          <div className="mt-4 md:mt-0 flex space-x-2 bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => { setActiveTab('dashboard'); setExtractedData(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Upload Trades
            </button>
            <button
              onClick={() => { setActiveTab('settings'); setExtractedData(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-red-600'}`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Dynamic Content Rendering */}
        {activeTab === 'dashboard' && <Dashboard />}

        {activeTab === 'upload' && !extractedData && (
          <FileUploader onExtractionSuccess={(data) => setExtractedData(data)} />
        )}

        {activeTab === 'upload' && extractedData && (
          <TradeTable
            initialData={extractedData}
            onReset={() => setExtractedData(null)}
          />
        )}

        {/* 3. The New Settings Component */}
        {activeTab === 'settings' && (
          <Settings
            onResetSuccess={() => {
              // Automatically switch back to Dashboard after a successful wipe
              setActiveTab('dashboard');
            }}
          />
        )}

      </div>
    </div>
  );
}