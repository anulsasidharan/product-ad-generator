import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === "/favicon.ico") {
    const url = request.nextUrl.clone();
    url.pathname = "/icon.svg";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/favicon.ico"],
};
