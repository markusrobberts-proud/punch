import { clerkMiddleware } from "@clerk/nextjs/server"

// Next.js 16 calls the request-interception entry "proxy" instead of "middleware".
// Clerk's clerkMiddleware works as the proxy handler.
export const proxy = clerkMiddleware()

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
