/**
 * Authentication Middleware
 */

import { SessionStore } from './session';

export function requireAuth(handler: any) {
  return async (context: any) => {
    // Get session token from header or cookie
    const token = context.headers.authorization?.replace('Bearer ', '') || 
                  context.cookie?.session;

    if (!token) {
      context.set.status = 401;
      return { error: 'Unauthorized: No session token provided' };
    }

    // Validate session
    const session = SessionStore.get(token);
    
    if (!session) {
      context.set.status = 401;
      return { error: 'Unauthorized: Invalid or expired session' };
    }

    // Attach session to context and ensure body is available
    const enhancedContext = {
      ...context,
      session,
      body: context.body,  // Explicitly pass body
      headers: context.headers,
      query: context.query,
      params: context.params,
      set: context.set
    };

    // Call the actual handler with enhanced context
    return handler(enhancedContext);
  };
}
