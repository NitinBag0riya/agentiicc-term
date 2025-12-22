/**
 * Cloudflare Function: Get Nonce
 *
 * Proxies the request to get a nonce from the backend
 */

interface Env {
  BACKEND_URL: string;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const backendUrl = env.BACKEND_URL;

  if (!backendUrl) {
    return new Response(
      JSON.stringify({ error: 'Backend URL not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await request.json();

    const backendResponse = await fetch(`${backendUrl}/tgma/get-nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const responseData = await backendResponse.json();

    return new Response(
      JSON.stringify(responseData),
      {
        status: backendResponse.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('Error proxying to backend:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to connect to backend',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
