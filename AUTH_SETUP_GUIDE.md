# Authentication & Database Setup Guide

## Overview

This application uses **Supabase Auth** for authentication and **PostgreSQL + Prisma** for the database.

## Authentication Architecture

### Client-Side (`lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
}
```

### Server-Side (`lib/supabase/server.ts`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
```

### Middleware (`middleware.ts`)

Protects routes automatically:

```typescript
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(url, anon, {
    cookies: { /* cookie handlers */ }
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to sign-in if not authenticated
  if (!isPublicRoute(pathname) && !user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return response;
}
```

## Database Architecture

### Technology Stack
- **Database**: PostgreSQL (hosted on Neon)
- **ORM**: Prisma
- **Connection**: Connection pooling via PgBouncer

### Schema Overview

```prisma
model User {
  id                  String   @id @default(cuid())
  authUserId          String   @unique  // Links to Supabase Auth user
  email               String?
  displayName         String?
  appTokens           Float    @default(4)
  integrationTokens   Int      @default(10)

  projects            Project[]
  tokenTransactions   TokenTransaction[]
}

model Project {
  id              String    @id @default(cuid())
  userId          String    // Foreign key to User
  prompt          String    @db.Text
  files           Json      // Generated files
  dependencies    Json      // npm packages
  isPublished     Boolean   @default(false)

  user            User      @relation(fields: [userId])
}
```

## Authentication Flow

### 1. **Sign In**
- User clicks "Sign in with Google"
- Redirects to Supabase OAuth
- Returns to `/auth/callback` with auth code
- Code exchanged for session
- Session stored in httpOnly cookies

### 2. **Session Management**
- Sessions automatically refreshed by `@supabase/ssr`
- Server components use `createClient()` from server
- Client components use `createClient()` from client
- Middleware validates session on each request

### 3. **User Data Sync**
- On sign-in, check if user exists in Prisma database
- If new user, create User record with `authUserId = supabase_user.id`
- Link all user data via `userId` foreign key

## Environment Variables

### Required for Auth

```bash
# Supabase (Authentication)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...  # Public key (safe to expose)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...      # Secret key (server-only!)

# Database (PostgreSQL via Neon)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```

### Security Notes

⚠️ **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client
✅ `NEXT_PUBLIC_*` variables are safe to expose (they're in browser anyway)

## Common Operations

### Get Current User (Server Component)

```typescript
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <div>Hello {user.email}</div>;
}
```

### Get Current User (Client Component)

```typescript
"use client";
import { useAuth } from "@/app/contexts/AuthContext";

export default function Component() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not signed in</div>;

  return <div>Hello {user.email}</div>;
}
```

### Protect API Route

```typescript
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Protected logic here
  return Response.json({ data: "secret" });
}
```

### Database Query with User Scope

```typescript
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/supabase-auth/server";

export async function GET() {
  const authUser = await currentUser();
  if (!authUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get Prisma user record
  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id }
  });

  // Fetch user's projects
  const projects = await prisma.project.findMany({
    where: { userId: user!.id }
  });

  return Response.json({ projects });
}
```

## Testing Authentication

### 1. Test Sign In Flow
```bash
# Start dev server
npm run dev

# Navigate to sign-in page
# http://localhost:3000/sign-in

# Click "Sign in with Google"
# Verify redirect to Google OAuth
# Verify redirect back to app after auth
```

### 2. Test Protected Routes
```bash
# Sign out
# Try accessing protected route
# Verify redirect to /sign-in
```

### 3. Test Database Sync
```bash
# Check database after new user signs in
npx prisma studio

# Verify:
# - User record created in `users` table
# - authUserId matches Supabase user ID
# - Default token balances set (4 app tokens, 10 integration tokens)
```

## Troubleshooting

### "User not found" errors
- Check that `authUserId` matches Supabase user ID
- Verify user was created in Prisma database after sign-in
- Check `/api/user/me` endpoint response

### Session not persisting
- Verify cookies are being set (check browser dev tools)
- Check middleware is running on protected routes
- Ensure `@supabase/ssr` version is latest

### Database connection issues
- Verify `DATABASE_URL` is correct
- Check PgBouncer pooling mode (should be session mode for Prisma)
- Run `npx prisma generate` after schema changes
- Run `npx prisma db push` to sync schema to database

## Generated Apps Authentication

When the AI generates apps with authentication:

1. **Only if requested** - Auth is added only when user explicitly needs it
2. **Proper structure** - Separate client/server Supabase clients
3. **Cookie sessions** - Secure httpOnly cookies via `@supabase/ssr`
4. **Middleware protection** - Routes protected at middleware level
5. **RLS policies** - Database tables secured with Row Level Security

### Example Generated Auth Structure

```
app/
├── lib/
│   └── supabase/
│       ├── client.ts    # Browser client
│       └── server.ts    # Server client
├── middleware.ts        # Route protection
├── auth/
│   └── callback/
│       └── route.ts     # OAuth callback handler
└── sign-in/
    └── page.tsx         # Sign-in UI
```

## Best Practices

1. **Never bypass middleware** - Don't check auth manually in every component
2. **Use server actions** - Prefer server actions over API routes for mutations
3. **Scope by user** - Always filter data by `userId` in queries
4. **Use RLS** - Enable Row Level Security on Supabase tables when possible
5. **Handle loading states** - Auth loads asynchronously, show loading UI
6. **Error boundaries** - Wrap auth-dependent code in error boundaries

---

**Last Updated**: February 2026
**Maintainer**: Review this guide when upgrading Supabase or Prisma
