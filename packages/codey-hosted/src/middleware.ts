/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip auth for health check and static assets
  if (
    request.nextUrl.pathname === '/api/health' ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon') ||
    request.nextUrl.pathname.startsWith('/vercel.svg')
  ) {
    return NextResponse.next();
  }

  // Simple token-based auth for POC
  const authHeader = request.headers.get('authorization');
  const validToken = process.env.POC_ACCESS_TOKEN;

  // If no token is configured, allow all requests (development mode)
  if (!validToken) {
    console.warn('POC_ACCESS_TOKEN not set - allowing all requests');
    return NextResponse.next();
  }

  // Check for valid authorization header
  if (!authHeader || authHeader !== `Bearer ${validToken}`) {
    return new NextResponse(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Valid authorization token required',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/sessions/:path*',
    '/((?!_next/static|_next/image|favicon.ico|vercel.svg).*)',
  ],
};
