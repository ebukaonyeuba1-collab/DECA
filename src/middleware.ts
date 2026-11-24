import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_FOR_ROLE, ROUTE_ROLES, type UserRole } from "@/lib/domain";

/** Refreshes the session and gates role-specific areas. Layouts re-check (defence in depth). */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rule = ROUTE_ROLES.find((r) => request.nextUrl.pathname === r.prefix || request.nextUrl.pathname.startsWith(r.prefix + "/"));
  if (!url || !key) return rule ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // validates the JWT with Supabase, not just the cookie
  if (!rule) return response;

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  const role = profile?.role as UserRole | undefined;
  if (!role || profile?.status !== "active" || !rule.roles.includes(role)) {
    return NextResponse.redirect(new URL(role ? HOME_FOR_ROLE[role] : "/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"] };
