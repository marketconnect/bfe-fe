import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { i18n } from './i18n-config'

function getLocale(request: NextRequest): string {
  // Simple language detection from Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')

  if (acceptLanguage) {
    // Check if Russian is preferred
    if (acceptLanguage.includes('ru')) {
      return 'ru'
    }
  }

  // Default to English
  return i18n.defaultLocale
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = i18n.locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)

    // e.g. incoming request is /products
    // The new URL is now /en-US/products
    return NextResponse.redirect(
      new URL(
        `/${locale}${pathname.startsWith('/') ? '' : '/'}${pathname}`,
        request.url
      )
    )
  }
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, `/dictionaries/`, and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|dictionaries|site.webmanifest).*)']
}
