'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ReadOnlyViewer from '../../../components/ReadOnlyViewer';

function ViewPageContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang as string;
  const searchParams = useSearchParams();
  const fileKey = searchParams.get('fileKey');

  const [pages, setPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !fileKey) {
      if (!token) router.push(`/${lang}/login`);
      return;
    }

    const fetchFile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.getPresignedFileInfo(token, fileKey);
        if (result.status === 'converted' && result.pages) {
          setPages(result.pages.map(p => api.toProxy(p)));
        } else {
          throw new Error("Этот файл не может быть открыт в режиме просмотра.");
        }
      } catch (err: any) {
        setError(err.message || "Просмотр поддерживается только для PDF-файлов.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFile();
  }, [token, fileKey, router, lang]);

  const handleClose = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Ошибка</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button onClick={handleClose} className="btn-primary">
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReadOnlyViewer
      fileName={fileKey?.split('/').pop() || 'File'}
      pages={pages}
      onClose={handleClose}
    />
  );
}

export default function ViewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ViewPageContent />
    </Suspense>
  );
}