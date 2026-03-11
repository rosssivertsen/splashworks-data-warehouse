import type {
  HealthResponse,
  QueryResponse,
  SchemaResponse,
  DictionaryResponse,
  PromptsResponse,
} from "../types/api";

export class UnansweredQueryError extends Error {
  confidence: string;
  partialAnswerHint: string | null;

  constructor(message: string, confidence: string, partialAnswerHint: string | null) {
    super(message);
    this.confidence = confidence;
    this.partialAnswerHint = partialAnswerHint;
  }
}

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
        const error = await response.json();
        if (error.detail) {
          // Handle structured error (422 unanswerable)
          if (typeof error.detail === "object" && error.detail.message) {
            const err = new UnansweredQueryError(
              error.detail.message,
              error.detail.confidence,
              error.detail.partial_answer_hint ?? null,
            );
            throw err;
          }
          message = error.detail;
        }
      } catch (e) {
        if (e instanceof UnansweredQueryError) throw e;
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
