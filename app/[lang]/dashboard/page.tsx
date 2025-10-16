'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { GetFilesResponse, FileEntry } from '@/lib/types';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    } catch {
        return '—';
    }
};

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

const DashboardPage = () => {
    const { token, logout } = useAuth();
    const router = useRouter();
    const params = useParams();
    const lang = params.lang as string;
    const searchParams = useSearchParams();
    const path = searchParams.get('path') || '';

    const [content, setContent] = useState<GetFilesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
    const [isDownloading, setIsDownloading] = useState(false);

    const [downloadProgress, setDownloadProgress] = useState<{ total: number; current: number; message: string } | null>(null);

    const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

    const fetchContent = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
        try {
            const data = await api.getFiles(token, path);
            setContent(data);
            setError('');
        } catch (err: any) {
            setContent(null);
            setError("Доступ ограничен");
        } finally {
            setLoading(false);
        }
    }, [token, path]);

    useEffect(() => {
        if (dictionary?.titles?.dashboard) {
            document.title = dictionary.titles.dashboard;
        }
    }, [dictionary]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    const canDownloadAnything = content?.files.some(f => f.accessType !== 'read_only') || (content?.folders && content.folders.length > 0);

    const handleFolderClick = (folderPath: string) => {
        router.push(`/${lang}/dashboard?path=${folderPath}`);
    };

    const handleFileClick = (file: FileEntry) => {
        if (file.accessType === 'read_only') {
            router.push(`/${lang}/view?fileKey=${encodeURIComponent(file.key)}`);
            return; 
        }
        openFile(file.key);
    };

    const handleBreadcrumbClick = (index: number) => {
        const segments = path.split('/').filter(Boolean);
        const isFirstHidden = segments.length > 0 && /^\d{16,}$/.test(segments[0]);
        if (index === 0) {
            router.push(`/${lang}/dashboard?path=`);
            return;
        }
        const sliceEnd = isFirstHidden ? index + 1 : index;
        const newPath = segments.slice(0, sliceEnd).join('/') + '/';
        router.push(`/${lang}/dashboard?path=${newPath}`);
    };

    const handleFileSelect = (key: string) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    const handleFolderSelect = (folder: string) => {
        setSelectedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folder)) newSet.delete(folder);
            else newSet.add(folder);
            return newSet;
        });
    };

    const handleClearSelection = () => {
        setSelectedFiles(new Set());
        setSelectedFolders(new Set());
    };

    const handleDownload = async () => {
        if (!token) return;
        const filesToDownload = Array.from(selectedFiles);
        const foldersToDownload = Array.from(selectedFolders);

        if (filesToDownload.length === 0 && foldersToDownload.length === 0) return;

        setIsDownloading(true);
        setError('');

        if (filesToDownload.length === 1 && foldersToDownload.length === 0) {
            try {
                await openFile(filesToDownload[0]);
                handleClearSelection();
            } catch (err: any) {
                setError(err.message || 'Failed to open file');
            } finally {
                setIsDownloading(false);
            }
            return;
        }

        // New logic for downloading multiple files as a zip
        try {
            const { urls } = await api.downloadArchive(token, filesToDownload, foldersToDownload);
            const files = Object.entries(urls);

            if (files.length === 0) {
                setError("Нет файлов для скачивания.");
                setTimeout(() => setError(''), 3000);
                setIsDownloading(false);
                return;
            }

            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            const failedDownloads: string[] = [];

            setDownloadProgress({ total: files.length, current: 0, message: 'Начинаем скачивание...' });

            for (let i = 0; i < files.length; i++) {
                const [key, url] = files[i];
                const fileName = key.split('/').pop() || key;
                setDownloadProgress({ total: files.length, current: i, message: `Скачивание файла ${i + 1} из ${files.length}: ${fileName}` });

                let zipPath = key;
                const segments = key.split('/');
                if (segments.length > 1 && /^\d{16,}$/.test(segments[0])) {
                    zipPath = segments.slice(1).join('/');
                }

                try {
                    const response = await fetch(toProxy(url as string));
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const blob = await response.blob();
                    zip.file(zipPath, blob);
                } catch (e) {
                    console.error(`Failed to download ${key}:`, e);
                    failedDownloads.push(key);
                }
            }

            setDownloadProgress({ total: files.length, current: files.length, message: 'Архивация...' });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'archive.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            if (failedDownloads.length > 0) {
                setError(`Не удалось скачать ${failedDownloads.length} файлов. Они не были включены в архив.`);
                setTimeout(() => setError(''), 5000);
            }

            handleClearSelection();
        } catch (err: any) {
            setError(err.message);
            setTimeout(() => setError(''), 5000);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    };

    const openFile = useCallback(async (key: string) => {
        if (!token) return;
        try {
            const freshUrl = await api.getFreshFileUrl(token, key);
            const finalUrl = toProxy(freshUrl);
            window.open(finalUrl, '_blank', 'noopener');
        } catch (e) {
            const err = e as Error;
            setError(err.message || 'Failed to open file');
        }
    }, [token]);

    const handleLogout = () => {
        logout();
        router.push(`/${lang}/login`);
    };

    const myFilesText = dictionary?.adminPanel?.fileManager?.myFiles || 'Мои файлы';

    const generateBreadcrumbs = (currentPath: string) => {
        const segments = currentPath.split('/').filter(Boolean);
        if (segments.length > 0 && /^\d{16,}$/.test(segments[0])) {
            return [myFilesText, ...segments.slice(1)];
        }
        return [myFilesText, ...segments];
    };

    const breadcrumbs = generateBreadcrumbs(path);
    const hasSelection = selectedFiles.size > 0 || selectedFolders.size > 0;
    const isEmpty = !loading && content && content.files.length === 0 && content.folders.length === 0;

    if (!dictionary) return <div>Loading...</div>;
    if (dictError) return <div>Failed to load translations.</div>;

    return (
        <div className="h-full flex flex-col">
            <header className="flex justify-between items-center p-4 border-b bg-white sticky top-0 z-30">
                <img src="/android-chrome-192x192.png" alt="Logo" className="h-10 w-auto" />
                <div className="flex items-center space-x-4">
                    <LanguageSwitcher />
                    <button
                        onClick={handleLogout}
                        title={dictionary.adminPanel.asideMenu.logout}
                        className="flex items-center p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="ml-2 hidden sm:block">{dictionary.adminPanel.asideMenu.logout}</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto flex flex-col">
                <div className="flex justify-start px-3 md:px-4 mt-4 mb-2">
                    <button
                        onClick={fetchContent}
                        disabled={loading}
                        className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={dictionary.adminPanel.fileManager.refresh}
                    >
                        <span className={`${loading ? 'animate-spin' : ''}`}>↻</span>
                        <span>{loading ? dictionary.adminPanel.fileManager.refreshing : dictionary.adminPanel.fileManager.refresh}</span>
                    </button>
                </div>

                {hasSelection && (
                    <div className="flex flex-wrap items-center gap-3 justify-between sticky top-0 z-20 bg-white px-3 md:px-4 py-3 mx-3 md:mx-4 my-1.5 border-b border-gray-200 shadow-sm rounded-lg">
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={handleClearSelection} className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                <span>{dictionary.adminPanel.selection.selected.replace('{count}', String(selectedFiles.size + selectedFolders.size))}</span>
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={!hasSelection || isDownloading}
                                className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span>{isDownloading ? dictionary.adminPanel.actions.downloading : dictionary.adminPanel.actions.download}</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 bg-white border border-gray-200 p-6 rounded-lg shadow-sm mx-3 md:mx-4 my-1.5">
                    <div className="p-4 flex items-center space-x-2 text-base text-gray-500">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={i}>
                                <button
                                    onClick={() => handleBreadcrumbClick(i)}
                                    className={`p-1 rounded-md transition-colors hover:underline disabled:no-underline disabled:cursor-default ${i === breadcrumbs.length - 1 ? 'font-semibold text-gray-700' : ''}`}
                                    disabled={i === breadcrumbs.length - 1}
                                >
                                    {crumb}
                                </button>
                                {i < breadcrumbs.length - 1 && <span className="text-gray-400 mx-1">/</span>}
                            </React.Fragment>
                        ))}
                    </div>

                    {loading ? (
                        <div className="text-center py-10">{dictionary.dashboard.loading}</div>
                    ) : (
                        <div className="px-4 md:px-6 py-4">
                            {error ? (
                                <div className="text-center py-10 text-gray-500">{error}</div>
                            ) : isEmpty ? (
                                <div className="text-center py-10 text-gray-500">В этой папке нет файлов</div>
                            ) : (
                                <div className="mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {content?.folders.map(folder => {
                                        const isSelected = selectedFolders.has(folder);
                                        return (
                                            <div key={folder} className={`group relative flex flex-col items-center p-4 rounded-lg transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                                <div onClick={() => handleFolderClick(folder)} className="flex flex-col items-center cursor-pointer">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                                    <span className="mt-2 text-sm text-center truncate w-full">{folder.split('/').filter(Boolean).pop()}</span>
                                                </div>
                                                {canDownloadAnything && (
                                                    <button onClick={() => handleFolderSelect(folder)} className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'opacity-100 bg-blue-500 border-blue-500' : 'opacity-0 group-hover:opacity-100 bg-white border-gray-300 hover:border-blue-400'}`}>
                                                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {content?.files.map(file => {
                                        const isSelected = selectedFiles.has(file.key);
                                        const isReadOnly = file.accessType === 'read_only';
                                        return (
                                            <div key={file.key} className={`group relative flex flex-col items-center p-4 rounded-lg transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                                {isReadOnly && (
                                                    <span className="absolute top-2 left-2 p-1 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center" title="Только для чтения">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                                        </svg>
                                                    </span>
                                                )}
                                                <div onClick={() => handleFileClick(file)} className="flex flex-col items-center cursor-pointer">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                                                    <span className="mt-2 text-sm text-center truncate w-full" title={file.key.split('/').pop()}>{file.key.split('/').pop()}</span>
                                                    {file.createdAt && <div className="text-xs text-gray-500 mt-1">{formatDate(file.createdAt)}</div>}
                                                </div>
                                                {canDownloadAnything && !isReadOnly && (
                                                    <button onClick={() => handleFileSelect(file.key)} className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'opacity-100 bg-blue-500 border-blue-500' : 'opacity-0 group-hover:opacity-100 bg-white border-gray-300 hover:border-blue-400'}`}>
                                                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Download Progress Indicator */}
            {downloadProgress && (
                <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 w-80 border animate-[fadeIn_0.3s_ease-in-out]">
                    <h4 className="font-bold text-sm">Подготовка архива</h4>
                    <p className="text-xs text-gray-600 mt-2 truncate">{downloadProgress.message}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-right text-xs mt-1">{downloadProgress.current} / {downloadProgress.total}</p>
                </div>
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
