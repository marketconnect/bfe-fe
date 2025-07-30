'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminRequired?: boolean;
}

const ProtectedRoute = ({ children, adminRequired = false }: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || (adminRequired && !isAdmin)) {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isAdmin, loading, router, adminRequired]);

  if (loading || !isAuthenticated || (adminRequired && !isAdmin)) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  return <>{children}</>;
};

export default ProtectedRoute;
