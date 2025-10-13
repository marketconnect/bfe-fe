'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent, useRef, useCallback, useMemo } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User, GetFilesResponse, Upload } from '@/lib/types';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const FileManager: React.FC<{ dictionary: any }> = ({ dictionary }) => {
  const { token, isAdmin, userId } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang as string;
  const searchParams = useSearchParams();
  const path = searchParams.get('path') || '';

  const [content, setContent] = useState<GetFilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [isUploadsPanelOpen, setIsUploadsPanelOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // State for drag and drop
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState<number | null>(null);
  const draggedItemsRef = useRef<{ files: string[], folders: string[] } | null>(null);

  // State for the move modal's file browser
  const [movePath, setMovePath] = useState('');
  const [moveContent, setMoveContent] = useState<GetFilesResponse | null>(null);
  const [moveLoading, setMoveLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchContent = useCallback(async () => {
    if (!token) return;
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setLoading(true);
    try {
      if (isAdmin && path === '') {
        if (userId && userId !== '1') {
          // Regular admin: their root is their user ID folder. Fetch its content directly.
          const userRootPath = `${userId}/`;
          const data = await api.getFiles(token, userRootPath);
          setContent(data);
        } else {
          // Super admin: show all top-level user folders.
          const folderData = await api.getAllFolders(token);
          const allFolders = folderData.folders || [];
          const foldersToShow = allFolders.filter(
            folder => folder.split('/').filter(Boolean).length === 1
          );
          setContent({ path: '/', folders: foldersToShow, files: [] });
        }
      } else {
        const data = await api.getFiles(token, path);
        setContent(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, path, isAdmin, userId]);
  const handleFileSelect = (key: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleFolderSelect = (folder: string) => {
    setSelectedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folder)) {
        newSet.delete(folder);
      } else {
        newSet.add(folder);
      }
      return newSet;
    });
  };

  const handleDeleteItems = async () => {
    if (!token) return;
    setIsDeleting(true);
    setError('');
    setMessage('');
    try {
      await api.deleteItems(token, Array.from(selectedFiles), Array.from(selectedFolders));
      setMessage(dictionary.adminPanel.messages.filesDeletedSuccess);
      setTimeout(() => setMessage(''), 3000);
      fetchContent();
    } catch (err: any) {
      setError(dictionary.adminPanel.errors.deleteFilesError || err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
    };
    if (showCreateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCreateDropdown]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleClearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

  useEffect(() => {
    if ((!showMoveModal && !showCopyModal) || !token) return;

    const fetchMoveContent = async () => {
      setMoveLoading(true);
      try {
        const data = await api.getFiles(token, movePath);
        setMoveContent(data);
      } catch (err: any) {
        console.error("Error fetching content for move/copy modal:", err);
      } finally {
        setMoveLoading(false);
      }
    };
    fetchMoveContent();
  }, [showMoveModal, showCopyModal, movePath, token]);

  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName.trim()) return;
    // Basic validation for folder name
    if (newFolderName.includes('/') || newFolderName.includes('..')) {
      setError("Folder name cannot contain '/' or '..'");
      return;
    }
    const fullPath = path ? `${path}${newFolderName}/` : `${newFolderName}/`;
    try {
      await api.createFolder(token, fullPath);
      setShowCreateFolderModal(false);
      setNewFolderName('');
      fetchContent();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startUpload = (files: FileList | null) => {
    if (!files || !token) return;
    setIsUploadsPanelOpen(true);
    const newUploads: Upload[] = Array.from(files).map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      progress: 0,
      status: 'pending',
    }));
    setUploads(prev => [...prev, ...newUploads]);

    newUploads.forEach(upload => {
      uploadFile(upload);
    });
  };

  const uploadFile = async (upload: Upload) => {
    if (!token) return;

    try {
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'uploading' } : u));
      const contentType = upload.file.type || 'application/octet-stream';
      const { uploadUrl } = await api.generateUploadUrl(token, upload.file.name, contentType, path);
      const proxiedUrl = uploadUrl.replace(
        'https://storage.yandexcloud.net',
        `${window.location.origin}/s3proxy`
      );
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', proxiedUrl, true);

      xhr.withCredentials = false;
      xhr.setRequestHeader('Content-Type', upload.file.type || 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, progress } : u));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'success', progress: 100 } : u));
          fetchContent();
        } else {
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'error', error: `HTTP Error: ${xhr.statusText}` } : u));
        }
      };
      xhr.onerror = () => {
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'error', error: dictionary.adminPanel.fileManager.uploadFailed } : u));
      };
      xhr.send(upload.file);

    } catch (err: any) {
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'error', error: err.message } : u));
    }
  };

  const handleDragEvents = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragOver(false);
    startUpload(e.dataTransfer.files);
  };

  const handleFolderClick = (folderPath: string) => {
    router.push(`/${lang}/admin?path=${folderPath}`);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      router.push(`/${lang}/admin?path=`);
    } else {
      const pathSegments = path.split('/').filter(Boolean);
      const isRegAdmin = isAdmin && userId && userId !== '1';

      if (isRegAdmin && pathSegments.length > 0 && pathSegments[0] === String(userId)) {
        const newPath = pathSegments.slice(0, index + 1).join('/') + '/';
        router.push(`/${lang}/admin?path=${newPath}`);
      } else {
        const newPath = pathSegments.slice(0, index).join('/') + '/';
        router.push(`/${lang}/admin?path=${newPath}`);
      }
    }
  };

  const handleMoveItems = async () => {
    if (!token) return;

    // Validation 1: Cannot move to the same folder
    if (movePath === path) {
      setError(dictionary.adminPanel.errors.cannotMoveToSameFolder);
      setTimeout(() => setError(''), 5000);
      setShowMoveModal(false);
      return;
    }

    // Validation 2: Cannot move a parent folder into its child
    const selectedFoldersArr = Array.from(selectedFolders);
    for (const folder of selectedFoldersArr) {
      if (movePath.startsWith(folder)) {
        setError(dictionary.adminPanel.errors.cannotMoveParentToChild);
        setTimeout(() => setError(''), 5000);
        setShowMoveModal(false);
        return;
      }
    }

    setIsMoving(true);
    setError('');
    setMessage('');

    try {
      const sources = Array.from(selectedFiles).concat(Array.from(selectedFolders));
      let destination = movePath;
      if (movePath === '') { // If moving to "My Files" (the root)
        if (isAdmin && userId && userId !== '1') { // Regular admin
          const firstSource = sources[0];
          if (firstSource) {
            const sourceRoot = firstSource.split('/')[0];
            destination = `${sourceRoot}/`;
          } else {
            setError("Cannot determine root folder from selection.");
            setTimeout(() => setError(''), 5000);
            setIsMoving(false);
            setShowMoveModal(false);
            return;
          }
        } else { // Superadmin
          destination = '/';
        }
      }
      await api.moveItems(token, sources, destination);
      setMessage(dictionary.adminPanel.messages.itemsMovedSuccess);
      setTimeout(() => setMessage(''), 3000);
      
      setShowMoveModal(false);
      handleClearSelection();
      fetchContent();
    } catch (err: any) {
      setError(dictionary.adminPanel.errors.moveItemsError || err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsMoving(false);
      setShowMoveModal(false);
    }
  };

  const handleCopyItems = async () => {
    if (!token) return;

    setIsCopying(true);
    setError('');
    setMessage('');

    try {
      const sources = Array.from(selectedFiles).concat(Array.from(selectedFolders));
      let destination = movePath; // Reusing movePath state for the modal
      if (movePath === '') { // If copying to "My Files" (the root)
        if (isAdmin && userId && userId !== '1') { // Regular admin
          const firstSource = sources[0];
          if (firstSource) {
            const sourceRoot = firstSource.split('/')[0];
            destination = `${sourceRoot}/`;
          } else {
            setError("Cannot determine root folder from selection.");
            setTimeout(() => setError(''), 5000);
            setIsCopying(false);
            setShowCopyModal(false);
            return;
          }
        } else { // Superadmin
          destination = '/';
        }
      }
      await api.copyItems(token, sources, destination);
      setMessage(dictionary.adminPanel.messages.itemsCopiedSuccess);
      setTimeout(() => setMessage(''), 3000);
      setShowCopyModal(false);
      handleClearSelection();
      if (path === movePath) {
        fetchContent();
      }
    } catch (err: any) {
      setError(dictionary.adminPanel.errors.copyItemsError || err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDownload = async () => {
    if (!token) return;
    const filesToDownload = Array.from(selectedFiles);
    const foldersToDownload = Array.from(selectedFolders);

    setIsDownloading(true);
    setError('');

    // Handle single file download differently
    if (filesToDownload.length === 1 && foldersToDownload.length === 0) {
      try {
        const fileKey = filesToDownload[0];
        const freshUrl = await api.getFreshFileUrl(token, fileKey);
        const finalUrl = toProxy(freshUrl);
        window.open(finalUrl, '_blank', 'noopener');
        handleClearSelection();
      } catch (err: any) {
        setError(err.message || 'Failed to open file');
        setTimeout(() => setError(''), 5000);
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    // Handle archive download for multiple items
    if (filesToDownload.length === 0 && foldersToDownload.length === 0) {
      setIsDownloading(false); // Nothing to do
      return;
    }

    try {
      await api.downloadArchive(token, filesToDownload, foldersToDownload);
      handleClearSelection();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, itemKey: string, isFolder: boolean) => {
    const currentSelectionFiles = new Set(selectedFiles);
    const currentSelectionFolders = new Set(selectedFolders);
    let sourcesToDrag;

    if ((isFolder && currentSelectionFolders.has(itemKey)) || (!isFolder && currentSelectionFiles.has(itemKey))) {
      sourcesToDrag = {
        files: Array.from(currentSelectionFiles),
        folders: Array.from(currentSelectionFolders)
      };
    } else {
      handleClearSelection();
      sourcesToDrag = {
        files: isFolder ? [] : [itemKey],
        folders: isFolder ? [itemKey] : []
      };
    }
    draggedItemsRef.current = sourcesToDrag;
    e.dataTransfer.setData('text/plain', JSON.stringify(sourcesToDrag));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    draggedItemsRef.current = null;
    setDragOverFolder(null);
    setDragOverBreadcrumb(null);
  };

  const handleDropMove = async (destination: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;

    setDragOverFolder(null);
    setDragOverBreadcrumb(null);

    const sourcesData = e.dataTransfer.getData('text/plain');
    if (!sourcesData) return;

    const { files, folders } = JSON.parse(sourcesData);
    const allSources = [...files, ...folders];

    // Validation 1: Cannot move a parent folder into its child
    for (const folder of folders) {
      if (destination.startsWith(folder)) {
        setError(dictionary.adminPanel.errors.cannotMoveParentToChild);
        setTimeout(() => setError(''), 5000);
        return;
      }
    }

    // Validation 2: Cannot drop items onto one of the dragged folders
    if (folders.includes(destination)) {
      return;
    }

    setIsMoving(true);
    setError('');
    setMessage('');

    try {
      let finalDestination = destination;
      if (destination === '') { // If moving to "My Files" (the root)
        if (isAdmin && userId && userId !== '1') { // Regular admin
          const firstSource = allSources[0];
          if (firstSource) {
            const sourceRoot = firstSource.split('/')[0];
            finalDestination = `${sourceRoot}/`;
          } else {
            setError("Cannot determine root folder from selection.");
            setTimeout(() => setError(''), 5000);
            setIsMoving(false);
            return;
          }
        } else { // Superadmin
          finalDestination = '/';
        }
      }
      await api.moveItems(token, allSources, finalDestination);
      setMessage(dictionary.adminPanel.messages.itemsMovedSuccess);
      setTimeout(() => setMessage(''), 3000);
      handleClearSelection();
      fetchContent();
    } catch (err: any) {
      setError(dictionary.adminPanel.errors.moveItemsError || err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsMoving(false);
    }
  };

  const handleFolderDragOver = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItemsRef.current) {
      const { folders: draggedFolders } = draggedItemsRef.current;
      for (const draggedFolder of draggedFolders) {
        if (targetFolder === draggedFolder || targetFolder.startsWith(draggedFolder)) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const getPathForBreadcrumbIndex = (index: number): string => {
    if (index === 0) return '';
    const pathSegments = path.split('/').filter(Boolean);
    return pathSegments.slice(0, index).join('/') + '/';
  };

  const handleBreadcrumbDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const targetPath = getPathForBreadcrumbIndex(index);
    if (draggedItemsRef.current?.folders.some(draggedFolder => targetPath === draggedFolder || targetPath.startsWith(draggedFolder))) {
      e.dataTransfer.dropEffect = 'none';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleMoveFolderClick = (folderPath: string) => {
    setMovePath(folderPath);
  };

  const handleMoveBreadcrumbClick = (index: number) => {
    if (index === 0) {
     // For regular admins, root is their own folder
      if (isAdmin && userId && userId !== '1') {
        setMovePath(`${userId}/`);
      } else {
        setMovePath('');
      }
    } else {
      const pathSegments = movePath.split('/').filter(Boolean);
      const isRegAdmin = isAdmin && userId && userId !== '1';

      if (isRegAdmin && pathSegments.length > 0 && pathSegments[0] === String(userId)) {
        const newPath = pathSegments.slice(0, index + 1).join('/') + '/';
        setMovePath(newPath);
      } else {
        const newPath = pathSegments.slice(0, index).join('/') + '/';
        setMovePath(newPath);
      }
    }
  };

  const myFilesText = dictionary?.adminPanel?.fileManager?.myFiles || 'My Files';
  const generateBreadcrumbs = (currentPath: string) => {
     const segments = currentPath.split('/').filter(Boolean);

    if (segments.length > 0 && /^\d{16,}$/.test(segments[0])) {

      // For a regular admin, their root folder is their user ID.
      // We display "My Files" for it and then the rest of the path, hiding the ID.
      return [myFilesText, ...segments.slice(1)];
    }
    return [myFilesText, ...segments];
  };
  const breadcrumbs = generateBreadcrumbs(path);
  const moveBreadcrumbs = generateBreadcrumbs(movePath);
  const hasSelection = selectedFiles.size > 0 || selectedFolders.size > 0;

  return (
    <div
      className="h-full flex flex-col relative"
      
    >
      {/* Header */}
      <div className="flex justify-between items-center p-2 min-h-[69px]">
        <div className="flex-1">
          {hasSelection ? (
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={handleClearSelection} className="flex items-center space-x-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                <span>{`${selectedFiles.size + selectedFolders.size} выбраны`}</span>
              </button>
              <button onClick={() => setShowDeleteModal(true)} className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                <span>Удалить</span>
              </button>
              <button onClick={() => { setShowMoveModal(true); setMovePath(''); }} className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 9l4 4m0 0l-4 4m4-4H3" /></svg>
                <span>{dictionary.adminPanel.fileManager.move}</span>
              </button>
              <button onClick={() => { setShowCopyModal(true); setMovePath(''); }} className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <span>Копировать в</span>
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>{isDownloading ? 'Скачивание...' : 'Скачать'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="relative" ref={createDropdownRef}>
                <button onClick={() => setShowCreateDropdown(!showCreateDropdown)} className="btn-primary flex items-center space-x-2">
                  <span>{dictionary.adminPanel.fileManager.create}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showCreateDropdown && (
                  <div className="absolute mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                    <button onClick={() => { setShowCreateFolderModal(true); setShowCreateDropdown(false); }} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{dictionary.adminPanel.fileManager.folder}</button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{dictionary.adminPanel.fileManager.uploadFile}</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasSelection && (
            <button
              onClick={fetchContent}
              disabled={loading}
              title={loading ? dictionary.adminPanel.fileManager.refreshing : dictionary.adminPanel.fileManager.refresh}
              className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M4.582 9A7.5 7.5 0 0119.5 15M19.418 15A7.5 7.5 0 014.5 9" />
              </svg>
              <span>{loading ? dictionary.adminPanel.fileManager.refreshing : dictionary.adminPanel.fileManager.refresh}</span>
            </button>
          )}
          <input type="file" multiple ref={fileInputRef} onChange={(e) => startUpload(e.target.files)} className="hidden" />
        </div>
      </div>

      {/* Local Messages */}
      {message && <div className="p-4"><div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">{message}</div></div>}
      {error && <div className="p-4"><div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div></div>}

      {/* Breadcrumbs */}
      <div className="p-4 flex items-center space-x-2 text-sm text-gray-500">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}> {
            (() => {
              const isLastCrumb = i === breadcrumbs.length - 1;
              const crumbPath = getPathForBreadcrumbIndex(i);
              return (<button
              onClick={() => handleBreadcrumbClick(i)}
              className={`p-1 rounded-md transition-colors hover:underline disabled:no-underline disabled:cursor-default ${dragOverBreadcrumb === i ? 'bg-blue-200' : ''}`}
              disabled={isLastCrumb}
              onDragEnter={(e) => !isLastCrumb && (e.preventDefault(), e.stopPropagation(), setDragOverBreadcrumb(i))}
              onDragLeave={(e) => !isLastCrumb && (e.preventDefault(), e.stopPropagation(), setDragOverBreadcrumb(null))}
              onDragOver={(e) => !isLastCrumb && handleBreadcrumbDragOver(e, i)}
              onDrop={(e) => !isLastCrumb && handleDropMove(crumbPath, e)}
            >{crumb}</button>);
            })()
          }
            {i < breadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto" onDragEnter={(e) => { handleDragEvents(e); setIsDragOver(true); }} onDragOver={handleDragEvents} onDragLeave={(e) => { handleDragEvents(e); setIsDragOver(false); }} onDrop={handleDrop}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Folders */}
          {(content?.folders || []).map(folder => {
            const isSelected = selectedFolders.has(folder);
            return (
              <div
                key={folder}
                className={`group relative flex flex-col items-center p-4 rounded-lg transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'} ${dragOverFolder === folder ? 'bg-blue-200 ring-2 ring-blue-500' : ''}`}
                draggable={!isMoving}
                onDragStart={(e) => handleDragStart(e, folder, true)}
                onDragEnd={handleDragEnd}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(folder); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(null); }}
                onDragOver={(e) => handleFolderDragOver(e, folder)}
                onDrop={(e) => handleDropMove(folder, e)}
              >
                <div onClick={() => handleFolderClick(folder)} className="flex flex-col items-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                  <span className="mt-2 text-sm text-center truncate w-full">{folder.split('/').filter(Boolean).pop()}</span>
                </div>
                <button onClick={() => handleFolderSelect(folder)} className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'opacity-100 bg-blue-500 border-blue-500' : 'opacity-0 group-hover:opacity-100 bg-white border-gray-300 hover:border-blue-400'}`}>
                  {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
              </div>
            );
          })}
          {/* Files */}
           {(content?.files || []).map(file => {
            const isSelected = selectedFiles.has(file.key);
            return (
              <div
                key={file.key}
                className={`group relative flex flex-col items-center p-4 rounded-lg transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                draggable={!isMoving}
                onDragStart={(e) => handleDragStart(e, file.key, false)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                  <span className="mt-2 text-sm text-center truncate w-full">{file.key.split('/').pop()}</span>
                </div>
                <button onClick={() => handleFileSelect(file.key)} className={`absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'opacity-100 bg-blue-500 border-blue-500' : 'opacity-0 group-hover:opacity-100 bg-white border-gray-300 hover:border-blue-400'}`}>
                  {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Uploads */}
      {uploads.length > 0 && isUploadsPanelOpen && (
        <div className="p-4 border-t bg-white">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">{dictionary.adminPanel.fileManager.uploads}</h3>
            <button onClick={() => setIsUploadsPanelOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {uploads.map(upload => (
              <div key={upload.id}>
                <div className="flex justify-between text-sm">
                  <span className="truncate w-40">{upload.file.name}</span>
                  <span>{upload.status === 'success' ? dictionary.adminPanel.fileManager.done : `${upload.progress}%`}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${upload.progress}%` }}></div>
                </div>
                {upload.status === 'error' && <p className="text-red-500 text-sm">{upload.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.fileManager.createFolder}</h2>
            <form onSubmit={handleCreateFolder}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={dictionary.adminPanel.fileManager.folderName}
                className="w-full p-2 border rounded"
                required
              />
              <div className="flex justify-end space-x-4 mt-4">
                <button type="button" onClick={() => setShowCreateFolderModal(false)} className="btn-secondary">{dictionary.adminPanel.fileManager.cancel}</button>
                <button type="submit" className="btn-primary">{dictionary.adminPanel.fileManager.create}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.fileManager.deleteConfirmTitle}</h2>
            <p className="mb-6">{dictionary.adminPanel.fileManager.deleteConfirmText}</p>
            <div className="flex justify-end space-x-4 mt-4">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary" disabled={isDeleting}>{dictionary.adminPanel.fileManager.cancel}</button>
              <button
                type="button"
                onClick={handleDeleteItems}
                className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? dictionary.adminPanel.fileManager.deleting : dictionary.adminPanel.fileManager.deleteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Items Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl h-3/4 flex flex-col">
            <h2 className="text-xl font-bold mb-4">{dictionary.adminPanel.fileManager.moveItemsTitle}</h2>
            <p className="text-sm text-gray-600 mb-4">{dictionary.adminPanel.fileManager.selectDestinationFolder}</p>

            {/* Breadcrumbs for Move Modal */}
            <div className="p-2 border-t border-b flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 rounded-md">
              {moveBreadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <button onClick={() => handleMoveBreadcrumbClick(i)} className="hover:underline disabled:no-underline disabled:cursor-default" disabled={i === moveBreadcrumbs.length - 1}>
                    {crumb}
                  </button>
                  {i < moveBreadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Content for Move Modal */}
            <div className="flex-1 py-4 overflow-y-auto">
              {moveLoading ? (
                <p>Loading...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(moveContent?.folders || []).map(folder => (
                    <div key={folder} onClick={() => handleMoveFolderClick(folder)} className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                      <span className="mt-2 text-sm text-center truncate w-full">{folder.split('/').filter(Boolean).pop()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-4 border-t pt-4">
              <button type="button" onClick={() => setShowMoveModal(false)} className="btn-secondary" disabled={isMoving}>
                {dictionary.adminPanel.fileManager.cancel}
              </button>
              <button
                type="button"
                onClick={handleMoveItems}
                className="btn-primary disabled:opacity-50"
                disabled={isMoving || moveLoading}
              >
                {isMoving ? dictionary.adminPanel.fileManager.moving : dictionary.adminPanel.fileManager.moveHere}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Items Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl h-3/4 flex flex-col">
            <h2 className="text-xl font-bold mb-4">{dictionary.adminPanel.fileManager.copyItemsTitle}</h2>
            <p className="text-sm text-gray-600 mb-4">{dictionary.adminPanel.fileManager.selectDestinationFolder}</p>

            {/* Breadcrumbs for Copy Modal */}
            <div className="p-2 border-t border-b flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 rounded-md">
              {moveBreadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <button onClick={() => handleMoveBreadcrumbClick(i)} className="hover:underline disabled:no-underline disabled:cursor-default" disabled={i === moveBreadcrumbs.length - 1}>
                    {crumb}
                  </button>
                  {i < moveBreadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                </React.Fragment>
              ))}
            </div>

            {/* Content for Copy Modal */}
            <div className="flex-1 py-4 overflow-y-auto">
              {moveLoading ? (
                <p>Loading...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(moveContent?.folders || []).map(folder => (
                    <div key={folder} onClick={() => handleMoveFolderClick(folder)} className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                      <span className="mt-2 text-sm text-center truncate w-full">{folder.split('/').filter(Boolean).pop()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-4 border-t pt-4">
              <button type="button" onClick={() => setShowCopyModal(false)} className="btn-secondary" disabled={isCopying}>
                {dictionary.adminPanel.fileManager.cancel}
              </button>
              <button
                type="button"
                onClick={handleCopyItems}
                className="btn-primary disabled:opacity-50"
                disabled={isCopying || moveLoading}
              >
                {isCopying ? dictionary.adminPanel.fileManager.copying : dictionary.adminPanel.fileManager.copyHere}
              </button>
            </div>
          </div>
        </div>
      )}
      {isMoving && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-lg font-semibold">{dictionary.adminPanel.fileManager.moving}</div>
        </div>
      )}

      {isCopying && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-lg font-semibold">{dictionary.adminPanel.fileManager.copying}</div>
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center z-20 pointer-events-none">
          <div className="text-white text-2xl font-bold">{dictionary.adminPanel.fileManager.dropFiles}</div>
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const { token, logout, isAdmin, userId } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<'users' | 'files' | 'settings'>('files');
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersViewMode, setUsersViewMode] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admins' | 'nonAdmins'>('all');
  const [filterNotify, setFilterNotify] = useState<'all' | 'on' | 'off'>('all');
  const [sortName, setSortName] = useState<'asc' | 'desc'>('asc');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  const filteredUsers = useMemo(() => {
    let data = Array.isArray(users) ? [...users] : [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter(u =>
        (u.alias || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
      );
    }
    if (filterRole !== 'all') {
      data = data.filter(u => (filterRole === 'admins' ? u.isAdmin : !u.isAdmin));
    }
    if (filterNotify !== 'all') {
      data = data.filter(u => (filterNotify === 'on' ? !!u.notifyByEmail : !u.notifyByEmail));
    }
    data.sort((a, b) => {
      const an = (a.alias || a.username || '').toLowerCase();
      const bn = (b.alias || b.username || '').toLowerCase();
      return sortName === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an);
    });
    return data;
  }, [users, searchQuery, filterRole, filterNotify, sortName]);
  const [adminForm, setAdminForm] = useState({ username: '', password: '', is_admin: false });
    const [newUserForm, setNewUserForm] = useState({ username: '', password: '', alias: '', email: '', is_admin: false, sendAuthByEmail: false, notifyByEmail: false });
  const [formErrors, setFormErrors] = useState<{ newUser: { username?: string; email?: string; }, settings: { username?: string; } }>({ newUser: {}, settings: {} });
  const [permissionForms, setPermissionForms] = useState<{ [key: string]: string }>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [allFolders, setAllFolders] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<{ [key: string]: boolean }>({});
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerUserId, setFolderPickerUserId] = useState<string | null>(null);
  const [folderPickerPath, setFolderPickerPath] = useState('');
  const [folderPickerContent, setFolderPickerContent] = useState<GetFilesResponse | null>(null);
  const [folderPickerLoading, setFolderPickerLoading] = useState(true);
  const params = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const lang = params.lang || 'en';
  const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

  useEffect(() => {
    if (dictionary?.titles?.admin) {
      document.title = dictionary.titles.admin;
    }
  }, [dictionary]);

  const fetchUsers = async () => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const userData = await api.getUsers(token);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err: any) {
      setError(dictionary?.adminPanel?.errors?.fetchUsers || err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAllFolders = async () => {
    if (!token) return;
    try {
      const folderData = await api.getAllFolders(token);
      setAllFolders(folderData.folders || []);
    } catch (err: any) {
      console.error(`${dictionary?.adminPanel?.errors?.fetchFolders || 'Failed to fetch folder list'}: ${err.message}`);
    }
  };

  useEffect(() => {
    if (dictionary) fetchUsers();
    if (dictionary) fetchAllFolders();
  }, [token, dictionary]);

  useEffect(() => {
    if (!folderPickerOpen || !token) return;
    const load = async () => {
      setFolderPickerLoading(true);
      try {
        const data = await api.getFiles(token, folderPickerPath);
        setFolderPickerContent(data);
      } catch (err: any) {
        console.error("Error fetching folders for picker:", err.message);
      } finally {
        setFolderPickerLoading(false);
      }
    };
    load();
  }, [folderPickerOpen, folderPickerPath, token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowDropdown({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleError = (err: any, prefix: string) => {
    const errorMsg = `${prefix}: ${err.message}`;
    setError(errorMsg);
    setTimeout(() => setError(''), 5000);
  };

  const handleAdminFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  };

  const handleAdminFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const errors: { username?: string; } = {};
    if (adminForm.username && !/^[a-zA-Z0-9_-]+$/.test(adminForm.username)) {
      errors.username = 'Логин может содержать только латинские буквы, цифры, _ и -.';
    }
    setFormErrors(prev => ({ ...prev, settings: errors }));
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await api.updateAdminSelf(token, adminForm.username, adminForm.password);
      showMessage(dictionary.adminPanel.messages.adminUpdated);
      setAdminForm({ username: '', password: '', is_admin: false });
      setTimeout(() => logout(), 2000);
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.updateAdmin);
    }
  };

  const handleNewUserFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setNewUserForm({ ...newUserForm, [target.name]: value });
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const errors: { username?: string; email?: string; } = {};
    if (!/^[a-zA-Z0-9_-]+$/.test(newUserForm.username)) {
      errors.username = 'Логин может содержать только латинские буквы, цифры, _ и -.';
    }
    if (newUserForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)) {
      errors.email = 'Пожалуйста, введите корректный email.';
    }
    setFormErrors(prev => ({ ...prev, newUser: errors }));
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      const response = await api.createUser(token, newUserForm.username, newUserForm.password, newUserForm.alias, newUserForm.email, newUserForm.is_admin, newUserForm.sendAuthByEmail, newUserForm.notifyByEmail);
      showMessage(dictionary.adminPanel.messages.userCreated.replace('{username}', newUserForm.username));
      const createdUsername = newUserForm.username;
      setNewUserForm({ username: '', password: '', alias: '', email: '', is_admin: false, sendAuthByEmail: false, notifyByEmail: false });
      fetchUsers();
      if (response.password) {
        setGeneratedPassword(response.password);
        setGeneratedUsername(createdUsername);
        setShowPasswordModal(true);
      }
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.createUser);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !userToReset || !newPassword) return;
    try {
      const response = await api.resetUserPassword(token, userToReset.id, newPassword);
      showMessage(dictionary.adminPanel.messages.passwordReset.replace('{username}', userToReset.alias || userToReset.username));
      const resetUsername = userToReset.username;
      setUserToReset(null);
      setNewPassword('');
      if (response.password) {
        setGeneratedPassword(response.password);
        setGeneratedUsername(resetUsername);
        setShowPasswordModal(true);
      }
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.resetPassword);
    }
  };

  const handleToggleNotify = async (userIdToUpdate: string, newNotifyValue: boolean) => {
    if (!token) return;

    const originalUsers = [...users];
    // Optimistic UI update
    setUsers(users.map(u => u.id === userIdToUpdate ? { ...u, notifyByEmail: newNotifyValue } : u));

    try {
      const userToUpdate = users.find(u => u.id === userIdToUpdate);
      if (userToUpdate) {
        await api.updateUserNotifySetting(token, userIdToUpdate, newNotifyValue);
        showMessage(dictionary.adminPanel.messages.notificationSettingUpdated.replace('{username}', userToUpdate.alias || userToUpdate.username));
      }
    } catch (err) {
      // Revert on error
      setUsers(originalUsers);
      handleError(err, dictionary.adminPanel.errors.notificationSettingUpdateFailed);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token || !confirm(dictionary.adminPanel.confirmDeleteUser)) return;
    try {
      await api.deleteUser(token, userId);
      showMessage(dictionary.adminPanel.messages.userDeleted);
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.deleteUser);
    }
  };

  const handlePermissionFormChange = (userId: string, value: string) => {
    setPermissionForms({ ...permissionForms, [userId]: value });
  };

  const toggleDropdown = (userId: string) => {
    setShowDropdown(prev => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [userId]: !prev[userId]
    }));
  };

  const selectFolder = (userId: string, folder: string) => {
    setPermissionForms({ ...permissionForms, [userId]: folder });
    setShowDropdown({ ...showDropdown, [userId]: false });
  };

  const handleAddPermission = async (e: FormEvent, userId: string) => {
    e.preventDefault();
    const folderPrefix = permissionForms[userId];
    if (!token || !folderPrefix) return;

 
    const user = users.find(u => u.id === userId);
    if (user && (user.permissions || []).some((p: any) => (p.folderPrefix ?? p.folder_prefix) === folderPrefix)) {
      handleError({ message: dictionary.adminPanel.errors.permissionExists }, dictionary.adminPanel.errors.addPermission);
      return;
    }
    if (user && (user.permissions || []).some(p => p.folderPrefix === folderPrefix)) {
      handleError({ message: dictionary.adminPanel.errors.permissionExists }, dictionary.adminPanel.errors.addPermission);
      return;
    }

    try {
      await api.assignPermission(token, userId, folderPrefix);
      showMessage(dictionary.adminPanel.messages.permissionAdded);
      setPermissionForms(prev => ({ ...prev, [userId]: '' }));
      setShowDropdown(prev => ({ ...prev, [userId]: false }));
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.addPermission);
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    if (!token || !confirm(dictionary.adminPanel.confirmRevokePermission)) return;
    try {
      await api.revokePermission(token, permissionId);
      showMessage(dictionary.adminPanel.messages.permissionRevoked);
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.revokePermission);
    }
  };

  const pickerBreadcrumbs = (() => {
    const parts = folderPickerPath.split('/').filter(Boolean);
    const myFilesText = dictionary?.adminPanel?.fileManager?.myFiles || 'My Files';
    return [myFilesText, ...parts];
  })();

  const getPickerPathForIndex = (index: number): string => {
    if (index === 0) return '';
    const parts = folderPickerPath.split('/').filter(Boolean);
    return parts.slice(0, index).join('/') + '/';
  };

  if (!dictionary) return <div>Loading...</div>;
  if (dictError) return <div>Failed to load translations.</div>;

  return (
    <div className="w-full h-screen font-inter flex flex-col md:flex-row bg-gray-50 overflow-x-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex justify-between items-center p-4 border-b bg-white">
        <img src="/android-chrome-192x192.png" alt="Admin Logo" className="h-8 w-auto" />
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          </button>
        </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r z-30 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 text-sm font-['Segoe_UI_Web_(Cyrillic)',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica_Neue',sans-serif] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`flex items-center p-4 border-b ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && <img src="/android-chrome-192x192.png" alt="Admin Logo" className="h-10 w-auto" />}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:block p-2 rounded-full hover:bg-gray-200">
            {isSidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 5l7 7-7 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        <nav className="flex-grow p-4 space-y-2">
          <button onClick={() => { setView('users'); setIsSidebarOpen(false); }} className={`w-full flex items-center p-2 rounded transition-colors hover:bg-gray-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`p-1 rounded transition-colors ${view === 'users' ? 'bg-bfe-orange text-white' : 'text-gray-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            {!isSidebarCollapsed && <span className={`ml-3 ${view === 'users' ? 'font-bold' : ''}`}>{dictionary.adminPanel.asideMenu.users}</span>}
          </button>
          <button onClick={() => { setView('files'); setIsSidebarOpen(false); }} className={`w-full flex items-center p-2 rounded transition-colors hover:bg-gray-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`p-1 rounded transition-colors ${view === 'files' ? 'bg-bfe-orange text-white' : 'text-gray-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </div>
            {!isSidebarCollapsed && <span className={`ml-3 ${view === 'files' ? 'font-bold' : ''}`}>{dictionary.adminPanel.asideMenu.files}</span>}
          </button>
          <button onClick={() => { setView('settings'); setIsSidebarOpen(false); }} className={`w-full flex items-center p-2 rounded transition-colors hover:bg-gray-100 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className={`p-1 rounded transition-colors ${view === 'settings' ? 'bg-bfe-orange text-white' : 'text-gray-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            {!isSidebarCollapsed && <span className={`ml-3 ${view === 'settings' ? 'font-bold' : ''}`}>{dictionary.adminPanel.asideMenu.settings}</span>}
          </button>
        </nav>
        <div className="p-4 border-t flex justify-center">
            <button
              onClick={() => {
                logout();
                router.push(`/${lang}/login`);
              }}
              title={dictionary.adminPanel.asideMenu.logout}
              className="flex items-center p-2 rounded hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!isSidebarCollapsed && <span className="ml-3">{dictionary.adminPanel.asideMenu.logout}</span>}
            </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white">
        <div className={view === 'users' ? 'p-4 md:p-8' : 'hidden'}>
          {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
          <div className="w-full max-w-4xl mx-auto">
            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={() => setShowCreateDrawer(true)}
                className="btn-primary"
              >
                {dictionary.adminPanel.users.toolbar.createUser}
              </button>
            </div>
            <div className="mb-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={dictionary.adminPanel.users.toolbar.searchPlaceholder}
                    className="w-full sm:w-64 p-2 border rounded-md bg-white"
                    aria-label={dictionary.adminPanel.users.toolbar.searchPlaceholder}
                  />
                  <div className="inline-flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setUsersViewMode('cards')}
                      className={`px-3 py-2 text-sm ${usersViewMode === 'cards' ? 'bg-bfe-orange text-white' : 'bg-white text-gray-700'}`}
                    >
                      {dictionary.adminPanel.users.toolbar.view.cards}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsersViewMode('table')}
                      className={`px-3 py-2 text-sm border-l ${usersViewMode === 'table' ? 'bg-bfe-orange text-white' : 'bg-white text-gray-700'}`}
                    >
                      {dictionary.adminPanel.users.toolbar.view.table}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as any)}
                    className="w-full sm:w-auto p-2 border rounded-md bg-white"
                  >
                    <option value="all">{dictionary.adminPanel.users.toolbar.filter.role.all}</option>
                    <option value="admins">{dictionary.adminPanel.users.toolbar.filter.role.admins}</option>
                    <option value="nonAdmins">{dictionary.adminPanel.users.toolbar.filter.role.nonAdmins}</option>
                  </select>
                  <select
                    value={filterNotify}
                    onChange={(e) => setFilterNotify(e.target.value as any)}
                    className="w-full sm:w-auto p-2 border rounded-md bg-white"
                  >
                    <option value="all">{dictionary.adminPanel.users.toolbar.filter.notify.all}</option>
                    <option value="on">{dictionary.adminPanel.users.toolbar.filter.notify.on}</option>
                    <option value="off">{dictionary.adminPanel.users.toolbar.filter.notify.off}</option>
                  </select>
                  <select
                    value={sortName}
                    onChange={(e) => setSortName(e.target.value as any)}
                    className="w-full sm:w-auto p-2 border rounded-md bg-white"
                  >
                    <option value="asc">{dictionary.adminPanel.users.toolbar.sort.nameAsc}</option>
                    <option value="desc">{dictionary.adminPanel.users.toolbar.sort.nameDesc}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="hidden">
              <div className="bg-white border border-gray-200 p-6 rounded-lg animate-[fadeIn_0.3s_ease-in-out] max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.createUserTitle}</h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <input type="text" name="alias" value={newUserForm.alias} onChange={handleNewUserFormChange} placeholder="Имя" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
                  <input type="text" name="username" value={newUserForm.username} onChange={handleNewUserFormChange} placeholder="login" className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
                  {formErrors.newUser.username && <p className="text-red-500 text-xs mt-1">{formErrors.newUser.username}</p>}
                  <input type="email" name="email" value={newUserForm.email} onChange={handleNewUserFormChange} placeholder="Email (необязательно)" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
                  {formErrors.newUser.email && <p className="text-red-500 text-xs mt-1">{formErrors.newUser.email}</p>}
                  <input type="password" name="password" value={newUserForm.password} onChange={handleNewUserFormChange} placeholder={dictionary.adminPanel.passwordPlaceholder} className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
                  {isAdmin && userId === '1' && (
                    <div className="flex items-center">
                      <input type="checkbox" name="is_admin" checked={newUserForm.is_admin} onChange={handleNewUserFormChange} className="mr-2" />
                      <label htmlFor="is_admin">Администратор</label>
                    </div>
                  )}
                  <div className="flex items-center">
                    <input type="checkbox" name="sendAuthByEmail" checked={newUserForm.sendAuthByEmail} onChange={handleNewUserFormChange} className="mr-2" disabled={!newUserForm.email} />
                    <label htmlFor="sendAuthByEmail" className={!newUserForm.email ? 'text-gray-400' : ''}>Отправить данные для входа по email</label>
                  </div>
                  {!(userId === '1' && newUserForm.is_admin) && (
                    <div className="flex items-center">
                      <input type="checkbox" name="notifyByEmail" checked={newUserForm.notifyByEmail} onChange={handleNewUserFormChange} className="mr-2" disabled={!newUserForm.email} />
                      <label htmlFor="notifyByEmail" className={!newUserForm.email ? 'text-gray-400' : ''}>{dictionary.adminPanel.notifyByEmailLabel}</label>
                    </div>
                  )}
                  <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.createUserButton}</button>
                </form>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-white/10 p-6 rounded-xl ring-1 ring-black/5 shadow-sm hover:shadow-md transition-shadow duration-200 md:hover:translate-y-[1px] animate-[fadeIn_0.3s_ease-in-out] mt-8 backdrop-blur-sm">
              <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.manageUsersTitle}</h2>
              {usersLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-6 border rounded-lg animate-pulse bg-gray-50 h-32" />
                  ))}
                </div>
              )}
              {!usersLoading && filteredUsers.length === 0 && (
                <div className="text-center p-6 bg-gray-50 border rounded-lg mb-4">
                  <h3 className="text-lg font-semibold mb-2">{dictionary.adminPanel.users.empty.title}</h3>
                  <p className="text-gray-600 mb-4">{dictionary.adminPanel.users.empty.text}</p>
                  <button onClick={() => setShowCreateDrawer(true)} className="btn-primary">{dictionary.adminPanel.users.empty.cta}</button>
                </div>
              )}
              <div className={`${usersViewMode !== 'table' || usersLoading || filteredUsers.length === 0 ? 'hidden' : ''} overflow-x-auto rounded-lg border mb-6`}>
                <div className="min-w-full divide-y">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="grid grid-cols-2 md:grid-cols-5 items-center p-3">
                      <div className="font-medium">{user.alias || user.username}</div>
                      <div className="text-gray-500">{user.username}</div>
                      <div className="text-gray-500 hidden md:block">{(user as any).email || '-'}</div>
                      <div>{user.isAdmin ? <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">{dictionary.adminPanel.users.badges.admin}</span> : null}</div>
                      <div className="flex items-center justify-end gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={user.notifyByEmail}
                            disabled={user.id === userId || user.isAdmin}
                            onChange={(e) => handleToggleNotify(user.id, e.target.checked)}
                          />
                          <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bfe-green peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
                        </label>
                        <button
                          onClick={() => setUserToReset(user)}
                          className="p-2 rounded-full hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                          title={dictionary.adminPanel.resetPasswordButton}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          title={dictionary.adminPanel.deleteUserTitle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${usersViewMode !== 'cards' || usersLoading || filteredUsers.length === 0 ? 'hidden' : ''} space-y-6`}>
                {filteredUsers.map(user => (
                  <div key={user.id} className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow animate-[fadeIn_0.3s_ease-in-out]">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800 font-montserrat">{user.alias || user.username}</h3>
                        <div className="flex items-center text-sm text-gray-500 mt-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{user.username}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setUserToReset(user)}
                          className="p-2 rounded-full hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                          title={dictionary.adminPanel.resetPasswordButton}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          title={dictionary.adminPanel.deleteUserTitle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-700 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-bfe-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {dictionary.adminPanel.notificationsLabel}
                        </h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={user.notifyByEmail}
                            disabled={user.id === userId || user.isAdmin}
                            onChange={(e) => handleToggleNotify(user.id, e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bfe-green peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-bfe-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        {dictionary.adminPanel.permissionsTitle}
                      </h4>
                      {user.permissions && user.permissions.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {user.permissions.map(perm => (
                            <div key={perm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="flex items-center">
                                <span className="mr-2">📁</span>
                                <span className="font-mono text-sm text-gray-700">{perm.folderPrefix}</span>
                              </div>
                              <button
                                onClick={() => handleRevokePermission(perm.id)}
                                className="p-1 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                                title={dictionary.adminPanel.revokePermissionButtonTitle}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-4 italic">{dictionary.adminPanel.noPermissions}</p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h5 className="text-sm font-medium text-gray-600 mb-2">{dictionary.adminPanel.addPermissionTitle}</h5>
                      <form onSubmit={(e) => handleAddPermission(e, user.id)} className="flex items-center space-x-3">
                        <div className="flex-grow relative">
                          <div className="relative dropdown-container">
                            <input
                              type="text"
                              value={permissionForms[user.id] || ''}
                              onChange={(e) => handlePermissionFormChange(user.id, e.target.value)}
                              placeholder={dictionary.adminPanel.folderPrefixPlaceholder}
                              className="w-full p-3 pr-10 border rounded-lg bg-gray-50 border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-bfe-orange focus:border-transparent"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => toggleDropdown(user.id)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {showDropdown[user.id] && allFolders.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {allFolders.map(folder => (
                                  <button
                                    key={folder}
                                    type="button"
                                    onClick={() => selectFolder(user.id, folder)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                  >
                                    📁 {folder}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setFolderPickerUserId(user.id); setFolderPickerPath(''); setFolderPickerOpen(true); }}
                          className="p-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Выбрать из дерева"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          className="p-3 bg-bfe-orange text-white rounded-lg hover:bg-bfe-orange-light transition-colors flex items-center justify-center"
                          title={dictionary.adminPanel.addPermissionButtonTitle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={view === 'files' ? 'h-full' : 'hidden'}>
          <FileManager dictionary={dictionary} />
        </div>
        <div className={view === 'settings' ? 'p-4 md:p-8' : 'hidden'}>
          <div className="w-full max-w-md mx-auto space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.updateAccountTitle}</h2>
              <div className="bg-white border border-gray-200 p-6 rounded-lg">
                <form onSubmit={handleAdminFormSubmit} className="space-y-4">
                  <input type="text" name="username" value={adminForm.username} onChange={handleAdminFormChange} placeholder={`${dictionary.adminPanel.usernamePlaceholder} (optional)`} className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
                  {formErrors.settings.username && <p className="text-red-500 text-xs mt-1">{formErrors.settings.username}</p>}
                  <input type="password" name="password" value={adminForm.password} onChange={handleAdminFormChange} placeholder={`${dictionary.adminPanel.passwordPlaceholder} (optional)`} className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
                  <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.updateAccountButton}</button>
                </form>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.language}</h2>
              <div className="bg-white border border-gray-200 p-6 rounded-lg flex justify-center">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </main>



      {showCreateDrawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowCreateDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{dictionary.adminPanel.createUserTitle}</h2>
              <button onClick={() => setShowCreateDrawer(false)} className="p-2 rounded hover:bg-gray-100" title={dictionary.adminPanel.users.createUser.closeDrawer}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input type="text" name="alias" value={newUserForm.alias} onChange={handleNewUserFormChange} placeholder="Имя" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              <input type="text" name="username" value={newUserForm.username} onChange={handleNewUserFormChange} placeholder="login" className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
              {formErrors.newUser.username && <p className="text-red-500 text-xs mt-1">{formErrors.newUser.username}</p>}
              <input type="email" name="email" value={newUserForm.email} onChange={handleNewUserFormChange} placeholder="Email (необязательно)" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              {formErrors.newUser.email && <p className="text-red-500 text-xs mt-1">{formErrors.newUser.email}</p>}
              <input type="password" name="password" value={newUserForm.password} onChange={handleNewUserFormChange} placeholder={dictionary.adminPanel.passwordPlaceholder} className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
              {isAdmin && userId === '1' && (
                <div className="flex items-center">
                  <input type="checkbox" name="is_admin" checked={newUserForm.is_admin} onChange={handleNewUserFormChange} className="mr-2" />
                  <label htmlFor="is_admin">Администратор</label>
                </div>
              )}
              <div className="flex items-center">
                <input type="checkbox" name="sendAuthByEmail" checked={newUserForm.sendAuthByEmail} onChange={handleNewUserFormChange} className="mr-2" disabled={!newUserForm.email} />
                <label htmlFor="sendAuthByEmail" className={!newUserForm.email ? 'text-gray-400' : ''}>Отправить данные для входа по email</label>
              </div>
              {!(userId === '1' && newUserForm.is_admin) && (
                <div className="flex items-center">
                  <input type="checkbox" name="notifyByEmail" checked={newUserForm.notifyByEmail} onChange={handleNewUserFormChange} className="mr-2" disabled={!newUserForm.email} />
                  <label htmlFor="notifyByEmail" className={!newUserForm.email ? 'text-gray-400' : ''}>{dictionary.adminPanel.notifyByEmailLabel}</label>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateDrawer(false)} className="btn-secondary">{dictionary.adminPanel.users.createUser.closeDrawer}</button>
                <button type="submit" className="btn-primary">{dictionary.adminPanel.createUserButton}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {folderPickerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl h-3/4 flex flex-col">
            <h2 className="text-xl font-bold mb-4">{dictionary?.adminPanel?.fileManager?.selectDestinationFolder || 'Выберите папку'}</h2>

            <div className="p-2 border-t border-b flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 rounded-md">
              {pickerBreadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <button
                    onClick={() => setFolderPickerPath(getPickerPathForIndex(i))}
                    className="hover:underline disabled:no-underline disabled:cursor-default"
                    disabled={i === pickerBreadcrumbs.length - 1}
                  >
                    {crumb}
                  </button>
                  {i < pickerBreadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                </React.Fragment>
              ))}
            </div>

            <div className="flex-1 py-4 overflow-y-auto">
              {folderPickerLoading ? (
                <p>Loading...</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(folderPickerContent?.folders || []).map(folder => (
                    <div
                      key={folder}
                      onClick={() => setFolderPickerPath(folder)}
                      className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-100 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                      <span className="mt-2 text-sm text-center truncate w-full">{folder.split('/').filter(Boolean).pop()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-4 border-t pt-4">
              <button
                type="button"
                onClick={() => { setFolderPickerOpen(false); setFolderPickerUserId(null); }}
                className="btn-secondary"
              >
                {dictionary?.adminPanel?.fileManager?.cancel || 'Отмена'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (folderPickerUserId && folderPickerPath) {
                    setPermissionForms(prev => ({ ...prev, [folderPickerUserId]: folderPickerPath }));
                    setFolderPickerOpen(false);
                    setFolderPickerUserId(null);
                  }
                }}
                className="btn-primary disabled:opacity-50"
                disabled={!folderPickerUserId || !folderPickerPath}
              >
                {dictionary?.adminPanel?.users?.folderPicker?.select || 'Выбрать'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative text-gray-800">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.passwordModalTitle}</h2>
            <p className="mb-4 text-sm text-gray-600">{dictionary.adminPanel.passwordModalNotice}</p>
            <div className="bg-gray-100 p-4 rounded-md font-mono text-sm mb-4 space-y-2">
              <div><strong>login:</strong> {generatedUsername}</div>
              <div><strong>password:</strong> {generatedPassword}</div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(`login: ${generatedUsername}\npassword: ${generatedPassword}`)}
                className="flex-1 btn-secondary"
              >
                {dictionary.adminPanel.copyButton}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setGeneratedPassword('');
                  setGeneratedUsername('');
                }}
                className="flex-1 btn-primary"
              >
                {dictionary.adminPanel.closeButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {userToReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.resetPasswordTitle.replace('{username}', userToReset.alias || userToReset.username)}</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="password" name="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={dictionary.adminPanel.newPasswordPlaceholder} className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
              <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.resetPasswordButton}</button>
            </form>
            <button onClick={() => setUserToReset(null)} className="w-full btn-secondary mt-2">{dictionary.adminPanel.backButton}</button>
          </div>
        </div>
      )}
    </div>
  );
};

const Page = () => (
  <ProtectedRoute adminRequired>
    <AdminPanel />
  </ProtectedRoute>
);

export default Page;

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
