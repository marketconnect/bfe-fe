'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getFiles } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';

interface FileData {
  key: string;
  url: string;
}

const DashboardPage = () => {
  const { token } = useAuth();
  const [files, setFiles] = useState<FileData[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      if (!token) return;
      try {
        const data = await getFiles(token);
        setFiles(data.files || []);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchFiles();
  }, [token]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Your Files</h1>
      {error && <p className="text-red-500">{error}</p>}
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.key} className="flex justify-between items-center p-3 bg-gray-100 rounded">
              <span>{file.key.split('/').pop()}</span>
              <a
                href={file.url}
                download
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No files found.</p>
      )}
    </div>
  );
};

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
