import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // 1. Cerrar sesión en Supabase
  await supabase.auth.signOut()

  // 2. Invalidar TODA la caché de las rutas del App Router
  revalidatePath('/', 'layout')

  // 3. Redirección limpia al login
  const url = new URL('/login', request.nextUrl.origin)
  
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
