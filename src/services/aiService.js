/**
 * AI Service Abstraction Layer
 * 
 * Provides a unified interface for multiple AI providers:
 * - OpenAI (GPT-3.5, GPT-4)
 * - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
 * 
 * This allows easy switching between providers and models for SQL generation.
 */

// Supported AI providers and their models
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

export const MODELS = {
  openai: [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High quality, balanced' },
    { id: 'gpt-4', name: 'GPT-4', description: 'Most capable OpenAI model' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best for SQL (recommended)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable Claude model' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and efficient' }
  ]
};

// Default models per provider
export const DEFAULT_MODELS = {
  openai: 'gpt-3.5-turbo',
  anthropic: 'claude-3-5-sonnet-20241022'
};

/**
 * AI Service class for unified provider access
 */
class AIService {
  /**
   * Generate SQL query from natural language
   * @param {Object} config - Configuration object
   * @param {string} config.provider - AI provider ('openai' or 'anthropic')
   * @param {string} config.apiKey - API key for the provider
   * @param {string} config.model - Model ID to use
   * @param {string} config.prompt - User prompt
   * @param {string} config.systemPrompt - System instructions
   * @param {number} config.maxTokens - Maximum tokens to generate
   * @param {number} config.temperature - Temperature for generation
   * @returns {Promise<string>} - Generated SQL query
   */
  async generateSQL(config) {
    const {
      provider,
      apiKey,
      model,
      prompt,
      systemPrompt,
      maxTokens = 500,
      temperature = 0.1
    } = config;

    if (!apiKey) {
      throw new Error(`API key required for ${provider}`);
    }

    if (provider === AI_PROVIDERS.OPENAI) {
      return this.callOpenAI(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else if (provider === AI_PROVIDERS.ANTHROPIC) {
      return this.callAnthropic(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Call OpenAI API
   * @private
   */
  async callOpenAI(apiKey, model, prompt, systemPrompt, maxTokens, temperature) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODELS.openai,
        messages: [
          {
            role: 'system',
            content: systemPrompt
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
      throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    return data.choices[0].message.content.trim();
  }

  /**
   * Call Anthropic API
   * @private
   */
  async callAnthropic(apiKey, model, prompt, systemPrompt, maxTokens, temperature) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Anthropic API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response from Anthropic API');
    }

    return data.content[0].text.trim();
  }

  /**
   * Generate insights from database schema
   * @param {Object} config - Configuration object
   * @returns {Promise<Array>} - Generated insights
   */
  async generateInsights(config) {
    const {
      provider,
      apiKey,
      model,
      prompt,
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.3
    } = config;

    if (!apiKey) {
      throw new Error(`API key required for ${provider}`);
    }

    let responseText;
    
    if (provider === AI_PROVIDERS.OPENAI) {
      responseText = await this.callOpenAI(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else if (provider === AI_PROVIDERS.ANTHROPIC) {
      responseText = await this.callAnthropic(apiKey, model, prompt, systemPrompt, maxTokens, temperature);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Parse insights from response
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }
  }

  /**
   * Test API connection
   * @param {string} provider - AI provider
   * @param {string} apiKey - API key to test
   * @param {string} model - Model to test with
   * @returns {Promise<Object>} - Test result
   */
  async testConnection(provider, apiKey, model) {
    try {
      const testPrompt = 'SELECT 1';
      const testSystem = 'You are a SQL expert. Return only: SELECT 1';
      
      await this.generateSQL({
        provider,
        apiKey,
        model: model || DEFAULT_MODELS[provider],
        prompt: testPrompt,
        systemPrompt: testSystem,
        maxTokens: 50,
        temperature: 0
      });
      
      return {
        success: true,
        message: `Successfully connected to ${provider}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();

// Export helper functions
export function getProviderName(provider) {
  const names = {
    openai: 'OpenAI',
    anthropic: 'Anthropic'
  };
  return names[provider] || provider;
}

export function getModelInfo(provider, modelId) {
  const models = MODELS[provider] || [];
  return models.find(m => m.id === modelId) || null;
}

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] || null;
}
