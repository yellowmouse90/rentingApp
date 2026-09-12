import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, just pass through
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Matches a path prefix on a segment boundary only, so "/auth/sign-up" doesn't also match
    // "/auth/sign-up-success" and "/dashboard" doesn't also match a hypothetical "/dashboard-foo".
    const matchesPath = (pathname: string, prefix: string) =>
      pathname === prefix || pathname.startsWith(prefix + "/")

    // Protected routes - redirect to login if not authenticated
    const protectedPaths = [
      "/dashboard",
      "/listings/new",
      "/bookings",
      "/messages",
      "/profile/edit",
    ]
    const pathname = request.nextUrl.pathname
    // The real route is /listings/[id]/edit - a plain prefix ("/listings/edit") never matches it.
    const isListingEditPath = /^\/listings\/[^/]+\/edit(\/|$)/.test(pathname)
    const isProtectedPath =
      isListingEditPath || protectedPaths.some((path) => matchesPath(pathname, path))

    if (isProtectedPath && !user) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("redirect", request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    // Auth routes - redirect to home if already authenticated
    const authPaths = ["/auth/login", "/auth/sign-up"]
    const isAuthPath = authPaths.some((path) => matchesPath(pathname, path))

    if (isAuthPath && user) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch {
    // If there's an error, just pass through
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

