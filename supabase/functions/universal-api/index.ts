import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Simple health check for Supabase Edge Function
serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Health check
    if (path === '/health' || path === '/') {
      return new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: Date.now(),
          message: 'Universal Trading API on Supabase'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // API documentation redirect
    if (path === '/docs' || path === '/docs/api') {
      return new Response(
        JSON.stringify({ 
          message: 'API Documentation',
          swagger: 'https://your-project.supabase.co/functions/v1/universal-api/openapi.json',
          endpoints: {
            health: '/health',
            assets: '/assets?exchange={aster|hyperliquid}',
            ticker: '/ticker/:symbol?exchange={aster|hyperliquid}',
            orderbook: '/orderbook/:symbol?exchange={aster|hyperliquid}'
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Default response
    return new Response(
      JSON.stringify({ 
        error: 'Not found',
        message: 'Visit /docs for API documentation'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
