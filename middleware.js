import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - /api/auth (authentication endpoints)
     * - /login (login page)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - /logo (logo files)
     * - /public (public files)
     */
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico|logo|public).*)',
  ],
};
