// netlify/functions/spots-remaining.js
// Serverless function to query Supabase for founder pricing spots remaining

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Query spots remaining using the SQL helper function
    const { data: proData, error: proError } = await supabase
      .rpc('get_spots_remaining', {
        target_tier: 'pro',
        target_pricing: 'founder'
      });

    const { data: premiumData, error: premiumError } = await supabase
      .rpc('get_spots_remaining', {
        target_tier: 'premium',
        target_pricing: 'founder'
      });

    if (proError || premiumError) {
      console.error('Supabase error:', proError || premiumError);
      throw new Error('Failed to query spots remaining');
    }

    // Return spots remaining
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        pro: {
          remaining: proData || 500,
          total: 500,
          percentage: Math.round(((proData || 500) / 500) * 100),
        },
        premium: {
          remaining: premiumData || 100,
          total: 100,
          percentage: Math.round(((premiumData || 100) / 100) * 100),
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Function error:', error);

    // Return fallback data on error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        pro: {
          remaining: 500,
          total: 500,
          percentage: 100,
        },
        premium: {
          remaining: 100,
          total: 100,
          percentage: 100,
        },
        error: 'Using fallback data',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
