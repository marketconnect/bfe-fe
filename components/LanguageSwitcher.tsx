'use client'

import { usePathname, useRouter } from 'next/navigation'
import { i18n, type Locale } from '@/i18n-config'

export default function LanguageSwitcher({ isCollapsed }: { isCollapsed?: boolean }) {
  const pathName = usePathname()
  const router = useRouter()

  const redirectedPathName = (locale: Locale) => {
    if (!pathName) return '/'
    const segments = pathName.split('/')
    segments[1] = locale
    return segments.join('/')
  }

  return (
    <div className={`flex justify-center ${isCollapsed ? 'flex-col space-y-2' : 'space-x-2'}`}>
      {i18n.locales.map(locale => {
        const currentLang = pathName.split('/')[1]
        const isActive = currentLang === locale
        return (
          <button
            key={locale}
            onClick={() => router.push(redirectedPathName(locale))}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              isActive ? 'bg-bfe-orange text-white font-bold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {locale.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
