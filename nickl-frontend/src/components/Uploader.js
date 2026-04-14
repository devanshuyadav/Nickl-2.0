"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function Uploader({ onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [uploadResult, setUploadResult] = useState(null); // New state for backend data

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles?.length > 0) {
            setFile(acceptedFiles[0]);
            setStatus('idle');
            setErrorMessage('');
            setUploadResult(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
    });

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        const formData = new FormData();
        formData.append('contractNote', file);

        try {
            const response = await axios.post('http://localhost:5000/api/upload/contract-note', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setUploadResult(response.data);
            setStatus('success');

            if (onUploadSuccess) {
                onUploadSuccess(); // Trigger dashboard refresh
            }

        } catch (error) {
            console.error('Upload Error:', error);
            setStatus('error');
            setErrorMessage(error.response?.data?.error || 'Failed to process the contract note.');
        }
    };

    const resetUploader = () => {
        setFile(null);
        setStatus('idle');
        setUploadResult(null);
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200">
            {status !== 'success' ? (
                <div
                    {...getRootProps()}
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
            ${status === 'uploading' ? 'opacity-50 pointer-events-none' : ''}`}
                >
                    <input {...getInputProps()} />

                    {file ? (
                        <div className="flex flex-col items-center text-center space-y-4">
                            <FileText className="w-12 h-12 text-blue-500" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">{file.name}</p>
                                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center space-y-4">
                            <UploadCloud className={`w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    <span className="text-blue-600">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-slate-500 mt-1">Groww Contract Note (PDF only)</p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // --- NEW SUCCESS UI: Shows database updates ---
                <div className="w-full border rounded-lg bg-green-50/50 border-green-200 p-6">
                    <div className="flex items-center text-green-700 font-semibold mb-4 border-b border-green-200 pb-3">
                        <CheckCircle className="w-6 h-6 mr-2" />
                        Database Updated Successfully
                    </div>

                    <div className="text-sm text-slate-600 mb-4 flex justify-between pr-2">
                        <span>Trade Date: <strong>{new Date(uploadResult.tradeDate).toLocaleDateString('en-IN')}</strong></span>
                        <span>Trades Saved: <strong>{uploadResult.tradeCount}</strong></span>
                    </div>

                    <div className="max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {uploadResult.tradesProcessed.map((trade, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded border border-slate-100 shadow-sm text-sm">
                                <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.type === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                        {trade.type}
                                    </span>
                                    <span className="font-medium text-slate-700 truncate w-32" title={trade.symbol}>
                                        {trade.symbol}
                                    </span>
                                </div>
                                <div className="text-slate-600 flex items-center space-x-2">
                                    <span>Qty: {trade.quantity}</span>
                                    <ArrowRight className="w-3 h-3 text-slate-300" />
                                    <span className="font-medium text-slate-800">₹{trade.totalValue.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button onClick={resetUploader} className="mt-5 w-full py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors">
                        Process Another File
                    </button>
                </div>
            )}

            {/* Action Area for Idle/Error States */}
            {status !== 'success' && (
                <div className="mt-6 flex flex-col items-center">
                    {status === 'idle' && (
                        <button onClick={handleUpload} disabled={!file} className={`w-full py-2.5 px-4 rounded-lg font-medium text-white transition-all ${file ? 'bg-blue-600 hover:bg-blue-700 shadow-md' : 'bg-slate-300 cursor-not-allowed'}`}>
                            Process Contract Note
                        </button>
                    )}

                    {status === 'uploading' && (
                        <div className="flex items-center text-blue-600 font-medium">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Extracting and calculating P&L...
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center text-red-600 w-full">
                            <div className="flex items-center font-medium bg-red-50 px-4 py-3 rounded-lg w-full border border-red-200">
                                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                                <span className="text-sm">{errorMessage}</span>
                            </div>
                            <button onClick={resetUploader} className="mt-3 text-sm text-slate-500 hover:text-slate-700 underline">
                                Try a different file
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}