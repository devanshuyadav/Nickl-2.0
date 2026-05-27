'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';

export default function FileUploader({ onExtractionSuccess }) {
    const [file, setFile] = useState(null);
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles?.length > 0) {
            setFile(acceptedFiles[0]);
            setError('');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file) return setError('Please select a PDF file.');
        if (!password) return setError('Please enter your PAN password.');

        setIsProcessing(true);
        setError('');

        const formData = new FormData();
        formData.append('contractNote', file);
        formData.append('password', password);
        // Passing password in headers or body depending on how your backend expects it.
        // If your backend pulls from .env, you don't actually need to send this, 
        // but it's good practice for a real app!

        try {
            const response = await fetch('/api/upload/extract-pdf', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract PDF');
            }

            // Pass the extracted data up to the parent page to display in the table
            onExtractionSuccess(data);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Contract Note</h2>

            {/* Dropzone Area */}
            <div
                {...getRootProps()}
                className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
                <input {...getInputProps()} />
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                {file ? (
                    <div className="flex items-center justify-center text-sm text-green-600 font-medium">
                        <FileText className="h-4 w-4 mr-2" />
                        {file.name}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm">
                        Drag & drop your Groww PDF here, or click to select
                    </p>
                )}
            </div>

            {/* Password Input */}
            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Required to unlock PDF"
                />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {/* Submit Button */}
            <button
                onClick={handleUpload}
                disabled={!file || !password || isProcessing}
                className="w-full mt-6 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex justify-center items-center"
            >
                {isProcessing ? (
                    <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Extracting...</>
                ) : (
                    'Extract Trades'
                )}
            </button>
        </div>
    );
}