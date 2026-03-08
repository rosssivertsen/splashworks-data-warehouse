import type {
  HealthResponse,
  QueryResponse,
  SchemaResponse,
  DictionaryResponse,
  PromptsResponse,
  ApiError,
} from "../types/api";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const error: ApiError = await response.json();
        if (error.detail) {
          message = error.detail;
        }
      } catch {
        // Use default message if body isn't JSON
      }
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", { method: "GET" });
  }

  async query(question: string, layer?: "warehouse" | "staging"): Promise<QueryResponse> {
    return this.request<QueryResponse>("/query", {
      method: "POST",
      body: JSON.stringify({ question, layer }),
    });
  }

  async queryRaw(sql: string, layer?: "warehouse" | "staging"): Promise<QueryResponse> {
    return this.request<QueryResponse>("/query/raw", {
      method: "POST",
      body: JSON.stringify({ sql, layer }),
    });
  }

  async getSchema(layer?: "warehouse" | "staging"): Promise<SchemaResponse> {
    const query = layer ? `?layer=${layer}` : "";
    return this.request<SchemaResponse>(`/schema${query}`, { method: "GET" });
  }

  async getDictionary(): Promise<DictionaryResponse> {
    return this.request<DictionaryResponse>("/schema/dictionary", { method: "GET" });
  }

  async getPrompts(): Promise<PromptsResponse> {
    return this.request<PromptsResponse>("/prompts", { method: "GET" });
  }
}

export const apiClient = new ApiClient();
