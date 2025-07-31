'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.push(`/${params.lang}/login`);
  }, [router, params.lang]);

  return null; // Or a loading spinner
}
