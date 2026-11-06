import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Ментору не нужен публичный лендинг: при жёстком заходе на `/` сразу
 * отправляем его в кабинет. Проверяем только не httpOnly-куку роли —
 * edge-рантайм middleware не может использовать jsonwebtoken и Sequelize.
 *
 * Это UX-редирект, а не защита: реальные проверки остаются в API.
 */
const ROLE_COOKIE = 'mp_role';
const MENTOR_HOME = '/mentor/templates';

export function middleware(request: NextRequest) {
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (role === 'mentor') {
    const url = request.nextUrl.clone();
    url.pathname = MENTOR_HOME;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
