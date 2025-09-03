import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 登录页面不需要认证
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }
  
  // 检查是否是管理员相关页面
  if (pathname.startsWith('/admin/')) {
    // 这里可以添加更复杂的认证逻辑
    // 目前只是简单的路由保护
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
