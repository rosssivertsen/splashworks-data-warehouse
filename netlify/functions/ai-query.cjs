/**
 * Netlify Serverless Function for AI Provider Proxy
 * 
 * This function proxies requests to OpenAI and Anthropic APIs
 * to avoid CORS issues and secure API keys.
 * 
 * Endpoint: /.netlify/functions/ai-query
 */

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { provider, apiKey, model, prompt, systemPrompt, maxTokens, temperature } = JSON.parse(event.body);

    // Validate required parameters
    if (!provider || !apiKey || !model || !prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Route to appropriate AI provider
    if (provider === 'openai') {
      return await handleOpenAI(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else if (provider === 'anthropic') {
      return await handleAnthropic(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Unsupported provider: ${provider}` })
      };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

/**
 * Handle OpenAI API request
 */
async function handleOpenAI(apiKey, model, prompt, systemPrompt, maxTokens = 500, temperature = 0.1) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API Error:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'OpenAI API Error',
          message: errorData.error?.message || response.statusText
        })
      };
    }

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('OpenAI request failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to connect to OpenAI',
        message: error.message
      })
    };
  }
}

/**
 * Handle Anthropic API request
 */
async function handleAnthropic(apiKey, model, prompt, systemPrompt, maxTokens = 500, temperature = 0.1) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20240620',
        system: systemPrompt || 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API Error:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Anthropic API Error',
          message: errorData.error?.message || response.statusText
        })
      };
    }

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Anthropic request failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to connect to Anthropic',
        message: error.message
      })
    };
  }
}
