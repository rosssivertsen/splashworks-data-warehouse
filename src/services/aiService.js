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
   * Call OpenAI API via Netlify serverless function
   * @private
   */
  async callOpenAI(apiKey, model, prompt, systemPrompt, maxTokens, temperature) {
    try {
      const response = await fetch('/.netlify/functions/ai-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'openai',
          apiKey,
          model: model || DEFAULT_MODELS.openai,
          prompt,
          systemPrompt,
          maxTokens,
          temperature
        })
      });

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If parsing fails, use status text
        }
        throw new Error(`OpenAI API Error: ${errorMessage}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error('Cannot connect to AI service. Make sure you are running "npm run dev" (not "npm run dev:vite") to start the Netlify functions.');
      }
      throw error;
    }
  }

  /**
   * Call Anthropic API via Netlify serverless function
   * @private
   */
  async callAnthropic(apiKey, model, prompt, systemPrompt, maxTokens, temperature) {
    try {
      const response = await fetch('/.netlify/functions/ai-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'anthropic',
          apiKey,
          model: model || DEFAULT_MODELS.anthropic,
          prompt,
          systemPrompt,
          maxTokens,
          temperature
        })
      });

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If parsing fails, use status text
        }
        throw new Error(`Anthropic API Error: ${errorMessage}`);
      }

      const data = await response.json();
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response from Anthropic API');
      }

      return data.content[0].text.trim();
    } catch (error) {
      if (error.message.includes('fetch') || error.message.includes('JSON')) {
        throw new Error('Cannot connect to AI service. Make sure you are running "npm run dev" (not "npm run dev:vite") to start the Netlify functions.');
      }
      throw error;
    }
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
