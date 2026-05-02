import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/login', '/verify', '/auth/callback'];
const PUBLIC_PREFIXES = ['/join'];
const PUBLIC_API_PREFIXES = ['/api/settle-matches', '/api/sync-matches'];

export async function middleware(request) {
    const path = request.nextUrl.pathname;

    // Allow cron/API routes to bypass auth entirely
    const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => path.startsWith(prefix));
    if (isPublicApi) {
        return NextResponse.next();
    }

    const response = NextResponse.next({
        request: { headers: request.headers },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value);
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const isPublicRoute = PUBLIC_ROUTES.includes(path)
        || PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));

    if (!user && !isPublicRoute) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    if (user && isPublicRoute) {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
