'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminRequired?: boolean;
}

const ProtectedRoute = ({ children, adminRequired = false }: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang || 'en';

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || (adminRequired && !isAdmin)) {
        router.push(`/${lang}/login`);
      }
    }
  }, [isAuthenticated, isAdmin, loading, router, adminRequired]);

 if (loading || !isAuthenticated || (adminRequired && !isAdmin)) {
    return <div>{lang === 'ru' ? 'Загрузка...' : 'Loading...'}</div>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
