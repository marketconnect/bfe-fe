'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getFiles } from '@/lib/api';
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
  const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

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
  }, [token, currentPath, lang]);

  const handleFolderClick = (folderPath: string) => {
    router.push(`/${lang}/dashboard?path=${folderPath}`);
  };

  const handleGoUp = () => {
    if (!content || !content.path) return;
    const parentPath = content.path.split('/').slice(0, -2).join('/') + '/';
    if (content.path !== parentPath) {
       router.push(`/${lang}/dashboard?path=${parentPath}`);
    }
  };

  const getDisplayName = (key: string) => key.split('/').filter(Boolean).pop();

  if (!dictionary) return <div>Loading...</div>;
  if (dictError) return <div>Failed to load translations.</div>;

  return (
    <ProtectedRoute>
      <div className="w-full max-w-4xl">
        <div className="flex justify-end items-center mb-6">
          <LanguageSwitcher />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-bfe-orange font-montserrat">{dictionary.dashboard.title}</h1>
        <div className="text-bfe-green font-mono bg-gray-100 border border-bfe-green p-2 rounded mb-4 break-all animate-[fadeIn_0.3s_ease-in-out]">
          {dictionary.dashboard.currentPath}: {content?.path || '/'}
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {loading ? <p>{dictionary.dashboard.loading}</p> : (
          <div className="space-y-4">
            {content && content.path && content.path !== '/' && !content.path.startsWith(content.folders?.[0]) && (
              <button onClick={handleGoUp} className="text-blue-400 hover:underline">{dictionary.dashboard.goUp}</button>
            )}
            <ul className="space-y-2">
              {content?.folders?.map((folder) => (
                <li key={folder} className="flex items-center p-3 bg-gray-100 rounded cursor-pointer hover:bg-bfe-orange-light animate-[fadeIn_0.3s_ease-in-out]" onClick={() => handleFolderClick(folder)}>
                  <span className="mr-2">📁</span>
                  <span>{getDisplayName(folder)}/</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-2">
              {content?.files?.map((file) => (
                <li key={file.key} className="flex justify-between items-center p-3 bg-gray-100 border border-gray-300 rounded animate-[fadeIn_0.3s_ease-in-out]">
                  <span className="mr-2">📄 {getDisplayName(file.key)}</span>
                  <a href={file.url} download className="bg-bfe-green text-white px-4 py-2 rounded hover:bg-bfe-green-light">{dictionary.dashboard.download}</a>
                </li>
              ))}
            </ul>
            {!content?.folders?.length && !content?.files?.length && <p>{dictionary.dashboard.emptyFolder}</p>}
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
