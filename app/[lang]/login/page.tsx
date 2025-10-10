'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import useSWR from 'swr';
import Head from 'next/head';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lang = params.lang || 'en';

  const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

  useEffect(() => {
    if (dictionary?.titles?.login) {
      document.title = dictionary.titles.login;
    }
  }, [dictionary]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { isAdmin } = await login(username, password);
      if (isAdmin) {
        router.push(`/${lang}/admin`);
      } else {
        router.push(`/${lang}/dashboard`);
      }
    } catch (err: any) {
      setError(dictionary?.loginPage?.error || 'Login failed');
    }
  };

  if (!dictionary) return <div>Loading...</div>;
  if (dictError) return <div>Failed to load translations.</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
      <div className="w-full max-w-xs flex flex-col items-center">
        <div className="w-full flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full">
          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 animate-[fadeIn_0.3s_ease-in-out]">
            <h1 className="text-center text-2xl font-bold mb-6 text-black">{dictionary.loginPage.title}</h1>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">{dictionary.loginPage.usernameLabel}</label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="username" type="text" placeholder={dictionary.loginPage.usernameLabel} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">{dictionary.loginPage.passwordLabel}</label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <button className="btn-primary focus:outline-none focus:shadow-outline" type="submit">{dictionary.loginPage.signInButton}</button>
            </div>
            {error && <p className="text-red-500 text-xs italic mt-4">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
