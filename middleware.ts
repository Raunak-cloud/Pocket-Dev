import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/sign-in(?:\/.*)?$/,
  /^\/sign-up(?:\/.*)?$/,
  /^\/auth\/callback$/,
  /^\/api\/webhooks(?:\/.*)?$/,
  /^\/api\/webhook\/stripe(?:\/.*)?$/,
  /^\/api\/inngest(?:\/.*)?$/,
];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PATTERNS.some((re) => re.test(pathname));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicRoute(request.nextUrl.pathname) && !user) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

