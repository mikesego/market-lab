import { clerkMiddleware } from "@clerk/nextjs/server";

// Authentication and authorization are enforced at every protected resource
// (page, route, and Server Action). Proxy only makes Clerk session context available.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
