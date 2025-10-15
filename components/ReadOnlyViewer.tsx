'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ReadOnlyViewerProps {
  fileName: string;
  pages: string[];
  onClose: () => void;
}

const ReadOnlyViewer: React.FC<ReadOnlyViewerProps> = ({ fileName, pages, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const pageNum = parseInt(entry.target.getAttribute('data-page-num') || '0', 10);
        if (pageNum) {
          setCurrentPage(pageNum);
        }
      }
    });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      root: scrollContainerRef.current,
      threshold: 0.5, // 50% of the page must be visible
    });

    pageRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      pageRefs.current.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [pages, observerCallback]);


  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-900 text-white shadow-lg flex-shrink-0">
        <h1 className="text-lg font-semibold truncate" title={fileName}>{fileName}</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Close viewer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Content */}
      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto text-center py-4">
        <div className="flex flex-col items-center space-y-4">
          {pages.map((pageUrl, index) => (
            <img
              key={index}
              ref={el => { pageRefs.current[index] = el; }}
              data-page-num={index + 1}
              src={pageUrl}
              alt={`Page ${index + 1}`}
              className="max-w-full h-auto bg-white shadow-lg"
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-2 bg-gray-900 text-white text-center text-sm flex-shrink-0">
        Страница {currentPage} из {pages.length}
      </footer>
    </div>
  );
};

export default ReadOnlyViewer;