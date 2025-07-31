'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getFiles } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { GetFilesResponse } from '@/lib/types';

const DashboardPage = () => {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';

  const [content, setContent] = useState<GetFilesResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await getFiles(token, currentPath);
        setContent(data);
        setError('');
      } catch (err: any) {
        setError(err.message);
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [token, currentPath]);

  const handleFolderClick = (folderPath: string) => {
    router.push(`/dashboard?path=${folderPath}`);
  };

  const handleGoUp = () => {
    if (!content || !content.path) return;
    const parentPath = content.path.split('/').slice(0, -2).join('/') + '/';
    // Ensure we don't go "above" the user's root permission
    // This check is primarily for UI; the backend enforces security.
    if (content.path !== parentPath) {
       router.push(`/dashboard?path=${parentPath}`);
    }
  };

  const getDisplayName = (key: string) => key.split('/').filter(Boolean).pop();

  return (
    <ProtectedRoute>
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2 text-bfe-orange font-montserrat">Your Files</h1>
      <div className="text-bfe-green font-mono bg-gray-100 border border-bfe-green p-2 rounded mb-4 break-all">
        Current Path: {content?.path || '/'}
      </div>

      {error && <p className="text-red-500">{error}</p>}
      {loading ? <p>Loading content...</p> : (
        <div className="space-y-4">
          {content && content.path && content.path !== '/' && !content.path.startsWith(content.folders?.[0]) && (
             <button onClick={handleGoUp} className="text-blue-400 hover:underline">.. (Go Up)</button>
          )}
          
          {/* Folders List */}
          <ul className="space-y-2">
            {content?.folders?.map((folder) => (
              <li key={folder} className="flex items-center p-3 bg-gray-100 rounded cursor-pointer hover:bg-bfe-orange-light" onClick={() => handleFolderClick(folder)}>
                <span className="mr-2">📁</span>
                <span>{getDisplayName(folder)}/</span>
              </li>
            ))}
          </ul>

          {/* Files List */}
          <ul className="space-y-2">
            {content?.files?.map((file) => (
              <li key={file.key} className="flex justify-between items-center p-3 bg-gray-100 border border-gray-300 rounded">
                <span className="mr-2">📄 {getDisplayName(file.key)}</span>
                <a href={file.url} download className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Download
                </a>
              </li>
            ))}
          </ul>
          {!content?.folders?.length && !content?.files?.length && <p>This folder is empty.</p>}
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
};

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
