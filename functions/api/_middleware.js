import { getUserFromRequest, jsonResponse } from './utils.js';

/**
 * Global Middleware for all /api/* routes.
 * Handles OPTIONS pre-flight requests and authenticates the JWT session.
 */
export async function onRequest(context) {
    const { request, next, env } = context;
    
    // 1. Handle CORS Pre-flight Options requests
    if (request.method === 'OPTIONS') {
        return jsonResponse({}, 200);
    }
    
    // 2. Load JWT Secret from Environment variable or fallback
    const secret = env.JWT_SECRET || undefined;
    
    // 3. Extract and verify authentication token
    try {
        const user = await getUserFromRequest(request, secret);
        context.data.user = user; // Set in request context data
    } catch (e) {
        console.error('Middleware auth parsing failed', e);
        context.data.user = null;
    }
    
    // 4. Continue to route handler
    return await next();
}
