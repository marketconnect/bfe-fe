'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { GetFilesResponse } from '@/lib/types';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DashboardPage = () => {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get('path') || '';
  const lang = params.lang || 'en';

  const [content, setContent] = useState<GetFilesResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

  useEffect(() => {
    if (dictionary?.titles?.dashboard) {
      document.title = dictionary.titles.dashboard;
    }
  }, [dictionary]);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await api.getFiles(token, currentPath);
        setContent(data);
        setError('');
      } catch (err: any) {
        setError(err.message);
        setContent(null);
      } finally {
        setLoading(false);
      }
    };
    // Reset selections on path change
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    fetchFiles();
  }, [token, currentPath, lang]);

  const handleFolderClick = (folderPath: string) => {
    router.push(`/${lang}/dashboard?path=${folderPath}`);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const pathParts = currentPath.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      pathParts.pop(); // Убираем последнюю часть пути
      const parentPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
      router.push(`/${lang}/dashboard?path=${parentPath}`);
    }
  };

  const getDisplayName = (key: string) => key.split('/').filter(Boolean).pop();

  const handleFileSelect = (key: string, isSelected: boolean) => {
    const newSelection = new Set(selectedFiles);
    if (isSelected) {
      newSelection.add(key);
    } else {
      newSelection.delete(key);
    }
    setSelectedFiles(newSelection);
  };

  const handleFolderSelect = (folder: string, isSelected: boolean) => {
    const newSelection = new Set(selectedFolders);
    if (isSelected) {
      newSelection.add(folder);
    } else {
      newSelection.delete(folder);
    }
    setSelectedFolders(newSelection);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allFiles = new Set(content?.files.map(f => f.key) || []);
      const allFolders = new Set(content?.folders || []);
      setSelectedFiles(allFiles);
      setSelectedFolders(allFolders);
    } else {
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    }
  };

  const handleDownload = async (keys: string[], folders: string[]) => {
    if (!token || (keys.length === 0 && folders.length === 0)) return;
    setIsDownloading(true);
    setError('');
    try {
      await api.downloadArchive(token, keys, folders);
      // Clear selection after download starts
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const openFile = React.useCallback(async (key: string) => {
    if (!token) return;
    try {
      const fresh = await api.getFreshFileUrl(token, key);
      const finalUrl = toProxy(fresh);
      window.open(finalUrl, '_blank', 'noopener');
    } catch (e) {
      const err = e as Error;
      setError(err.message || 'Failed to open file');
    }
  }, [token]);

  const totalItems = (content?.files?.length || 0) + (content?.folders?.length || 0);
  const totalSelected = selectedFiles.size + selectedFolders.size;
  const isAllSelected = totalItems > 0 && totalSelected === totalItems;

  if (!dictionary) return <div>Loading...</div>;
  if (dictError) return <div>Failed to load translations.</div>;

  return (
    <ProtectedRoute>
      <div className="flex flex-col items-center min-h-full py-8 px-4">
        <div className="w-full max-w-4xl">
          <div className="flex justify-end items-center mb-6">
            <LanguageSwitcher />
            </div>
          <h1 className="text-3xl font-bold mb-2 text-bfe-orange font-montserrat">{dictionary.dashboard.title}</h1>
          <div className="text-bfe-green font-mono bg-gray-100 border border-bfe-green p-2 rounded mb-4 break-all animate-[fadeIn_0.3s_ease-in-out]">
            {dictionary.dashboard.currentPath}: {content?.path || '/'}
          </div>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

          <div className="flex justify-between items-center mb-4">
            <div>
              {currentPath && currentPath !== '' && (
                <button onClick={handleGoUp} className="text-blue-400 hover:underline">{dictionary.dashboard.goUp}</button>
              )}
            </div>
            {totalSelected > 0 && (
              <button
                onClick={() => handleDownload(Array.from(selectedFiles), Array.from(selectedFolders))}
                disabled={isDownloading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? dictionary.dashboard.downloading : `${dictionary.dashboard.downloadSelected} (${totalSelected})`}
              </button>
            )}
          </div>

          {loading ? <p>{dictionary.dashboard.loading}</p> : (
            <div className="space-y-2">
              {totalItems > 0 && (
                <div className="flex items-center p-3 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mr-4"
                    onChange={handleSelectAll}
                    checked={isAllSelected}
                  />
                  <span>{dictionary.dashboard.selectAll}</span>
                  </div>
              )}
              {content?.folders?.map((folder) => (
                <div key={folder} className="flex items-center p-3 bg-gray-100 rounded hover:bg-gray-200 animate-[fadeIn_0.3s_ease-in-out]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mr-4"
                    checked={selectedFolders.has(folder)}
                    onChange={(e) => handleFolderSelect(folder, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-grow cursor-pointer" onClick={() => handleFolderClick(folder)}>
                    <span className="mr-2">📁</span>
                    <span>{getDisplayName(folder)}/</span>
                  </div>
                  <button
                    onClick={() => handleDownload([], [folder])}
                    disabled={isDownloading}
                    className="bg-bfe-green text-white px-3 py-1 rounded hover:bg-bfe-green-light text-sm disabled:opacity-50"
                    title={`${dictionary.dashboard.downloadFolder} '${getDisplayName(folder)}'`}
                  >
                    {dictionary.dashboard.download}
                  </button>
                </div>
              ))}
              {content?.files?.map((file) => (
                <div key={file.key} className="flex items-center p-3 bg-gray-100 border border-gray-200 rounded animate-[fadeIn_0.3s_ease-in-out]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 mr-4"
                    checked={selectedFiles.has(file.key)}
                    onChange={(e) => handleFileSelect(file.key, e.target.checked)}
                  />
                  <span className="flex-grow mr-2">📄 {getDisplayName(file.key)}</span>

                  
                  <button
                    onClick={(e) => { e.stopPropagation(); openFile(file.key); }}
                    className="bg-bfe-green text-white px-3 py-1 rounded hover:bg-bfe-green-light text-sm"
                    title={dictionary.dashboard.download}
                  >
                    {dictionary.dashboard.download}
                  </button>

                </div>
              ))}

              {totalItems === 0 && <p className="text-gray-500 italic mt-4">{dictionary.dashboard.emptyFolder}</p>}
            </div>
          )}
        </div>
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

const toProxy = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'storage.yandexcloud.net') {
      return `/s3proxy${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
};

