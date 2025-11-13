// Environment Configuration
// This file provides environment-specific settings for the application

export interface EnvironmentConfig {
  name: string;
  apiBaseUrl: string;
  enableDebugLogs: boolean;
  enableAnalytics: boolean;
  maxFileSize: number; // in bytes
  aiProviders: {
    openai: {
      enabled: boolean;
      maxTokens: number;
    };
    anthropic: {
      enabled: boolean;
      maxTokens: number;
    };
  };
}

// Get current environment from build-time variables
const getCurrentEnvironment = (): string => {
  if (typeof window !== 'undefined') {
    // Client-side detection
    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'development';
    }
    if (hostname.includes('dev--') || hostname.includes('-dev.')) {
      return 'development';
    }
    if (hostname.includes('staging--') || hostname.includes('-staging.')) {
      return 'staging';
    }
    return 'production';
  }
  
  // Server-side detection
  return (import.meta as any).env?.REACT_APP_ENV || 
         (import.meta as any).env?.ENVIRONMENT || 
         (import.meta as any).env?.NODE_ENV || 
         'production';
};

// Environment-specific configurations
const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: 'Development',
    apiBaseUrl: 'http://localhost:8888/.netlify/functions',
    enableDebugLogs: true,
    enableAnalytics: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB for development testing
    aiProviders: {
      openai: {
        enabled: true,
        maxTokens: 2000,
      },
      anthropic: {
        enabled: true,
        maxTokens: 2000,
      },
    },
  },
  
  staging: {
    name: 'Staging',
    apiBaseUrl: '/.netlify/functions',
    enableDebugLogs: true,
    enableAnalytics: false,
    maxFileSize: 50 * 1024 * 1024, // 50MB for staging
    aiProviders: {
      openai: {
        enabled: true,
        maxTokens: 1500,
      },
      anthropic: {
        enabled: true,
        maxTokens: 1500,
      },
    },
  },
  
  production: {
    name: 'Production',
    apiBaseUrl: '/.netlify/functions',
    enableDebugLogs: false,
    enableAnalytics: true,
    maxFileSize: 25 * 1024 * 1024, // 25MB for production
    aiProviders: {
      openai: {
        enabled: true,
        maxTokens: 1000,
      },
      anthropic: {
        enabled: true,
        maxTokens: 1000,
      },
    },
  },
  
  preview: {
    name: 'Preview',
    apiBaseUrl: '/.netlify/functions',
    enableDebugLogs: true,
    enableAnalytics: false,
    maxFileSize: 50 * 1024 * 1024,
    aiProviders: {
      openai: {
        enabled: true,
        maxTokens: 1000,
      },
      anthropic: {
        enabled: true,
        maxTokens: 1000,
      },
    },
  },
};

// Get current configuration
export const config: EnvironmentConfig = environments[getCurrentEnvironment()] || environments.production;

// Debug helper
export const debugLog = (...args: any[]) => {
  if (config.enableDebugLogs) {
    console.log(`[${config.name}]`, ...args);
  }
};

// Export utilities
export { getCurrentEnvironment };
export default config;