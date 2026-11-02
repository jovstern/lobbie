import { toNextJsHandler } from 'better-auth/next-js'
import { getAuth } from '@/app/lib/auth'

// The magic link in the email lands here (GET /api/auth/magic-link/verify).
export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request))
