'use client';
import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import TradeTable from '@/components/TradeTable';

export default function Home() {
  const [extractedData, setExtractedData] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Portfolio Engine
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Upload contract notes or manually enter trades to update your FIFO ledger.
          </p>
        </div>

        {/* State Machine: If we have data, show the Table. If not, show the Uploader. */}
        {!extractedData ? (
          <FileUploader onExtractionSuccess={(data) => setExtractedData(data)} />
        ) : (
          <TradeTable
            initialData={extractedData}
            onReset={() => setExtractedData(null)}
          />
        )}
      </div>
    </div>
  );
}