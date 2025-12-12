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

    // Attach session to context
    context.session = session;

    // Call the actual handler
    return handler(context);
  };
}
