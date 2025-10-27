// Core Type Definitions for Pool Service BI Dashboard

// Database Types
export interface Database {
  exec(sql: string): QueryExecResult[];
  close(): void;
}

export interface QueryExecResult {
  columns: string[];
  values: any[][];
}

export interface QueryResults {
  query?: string;
  columns: string[];
  values: any[][];
  rowCount: number;
  originalQuestion?: string;
  executionTime?: number;
}

// Dashboard Types
export interface Dashboard {
  id: number;
  name: string;
  description?: string;
  charts: Chart[];
  layout: ChartLayout[];
  settings?: DashboardSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Chart {
  id: number;
  type: ChartType;
  title: string;
  query: string;
  description?: string;
  data?: ChartData;
  config?: ChartConfig;
  position: ChartPosition;
  createdAt?: string;
  updatedAt?: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'doughnut';

export interface ChartData {
  columns: string[];
  values: any[][];
}

export interface ChartConfig {
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
  smooth?: boolean;
  [key: string]: any;
}

export interface ChartPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardSettings {
  theme?: 'light' | 'dark';
  autoRefresh?: boolean;
  refreshInterval?: number;
  showGrid?: boolean;
  [key: string]: any;
}

// Insight Types
export interface Insight {
  id?: number;
  title: string;
  description: string;
  type: InsightType;
  impact: InsightImpact;
  query?: string;
  data?: ChartData;
  rowCount?: number;
  recommendation?: string;
  createdAt?: string;
}

export type InsightType = 'Trend' | 'Anomaly' | 'Opportunity' | 'Warning' | 'Performance';

export type InsightImpact = 'High' | 'Medium' | 'Low';

// AI Message Types
export interface AIMessage {
  id: number;
  type: 'user' | 'ai' | 'error' | 'system';
  content: string;
  insights?: Insight[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type AIIntent = 
  | 'create_dashboard' 
  | 'create_chart' 
  | 'generate_insights' 
  | 'query_data' 
  | 'general';

// Component Props Types
export interface DatabaseUploaderProps {
  sqlInstance: any;
  onDatabaseLoad: (database: Database) => void;
  onFileUpload: (file: File) => Promise<void>;
}

export interface DatabaseExplorerProps {
  database: Database;
  onQueryExecute: (results: QueryResults) => void;
}

export interface AIAssistantProps {
  database: Database;
  apiKey: string | null;
  onQueryExecute: (results: QueryResults) => void;
  dashboards: Dashboard[];
  setDashboards: (dashboards: Dashboard[]) => void;
  selectedDashboard: Dashboard | null;
  setSelectedDashboard: (dashboard: Dashboard | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export interface AIQueryInterfaceProps {
  database: Database;
  apiKey: string | null;
  onQueryExecute: (results: QueryResults) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export interface DashboardViewProps {
  database: Database;
  dashboards: Dashboard[];
  setDashboards: (dashboards: Dashboard[]) => void;
  selectedDashboard: Dashboard | null;
  setSelectedDashboard: (dashboard: Dashboard | null) => void;
  apiKey: string | null;
  onQueryExecute: (results: QueryResults) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export interface InsightsPanelProps {
  database: Database;
  apiKey: string | null;
  onQueryExecute: (results: QueryResults) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export interface DataExplorerProps {
  database: Database;
  onQueryExecute: (results: QueryResults) => void;
}

export interface QueryResultsProps {
  results: QueryResults;
}

export interface ChartRendererProps {
  chart: Chart;
}

export interface ChartBuilderProps {
  database: Database;
  apiKey: string | null;
  onSave: (chart: Chart) => void;
  onClose: () => void;
}

export interface InsightCardProps {
  insight: Insight;
  index: number;
  onViewData?: (insight: Insight) => void;
  onEdit?: (insight: Insight, index: number) => void;
  onDelete?: (index: number) => void;
}

// Hook Return Types
export interface UseDatabaseReturn {
  database: Database | null;
  sqlInstance: any;
  sqlLoading: boolean;
  sqlError: string | null;
  dbSchema: string;
  isDatabaseReady: boolean;
  handleDatabaseUpload: (file: File) => Promise<Database>;
  generateDatabaseSchema: () => string;
  getTables: () => string[];
  getTableSchema: (tableName: string) => QueryExecResult;
  executeQuery: (query: string) => QueryExecResult[];
  clearDatabase: () => Promise<void>;
  setDatabase: (database: Database | null) => void;
}

export interface UseDashboardReturn {
  dashboards: Dashboard[];
  selectedDashboard: Dashboard | null;
  isGenerating: boolean;
  dashboardError: string | null;
  createDashboard: (name?: string, options?: Partial<Dashboard>) => Dashboard;
  updateDashboard: (dashboardId: number, updates: Partial<Dashboard>) => void;
  deleteDashboard: (dashboardId: number) => void;
  duplicateDashboard: (dashboardId: number, newName?: string) => Dashboard;
  addChart: (dashboardId: number, chartConfig: Partial<Chart>) => Chart;
  updateChart: (dashboardId: number, chartId: number, updates: Partial<Chart>) => void;
  removeChart: (dashboardId: number, chartId: number) => void;
  getDashboard: (dashboardId: number) => Dashboard | undefined;
  getChart: (dashboardId: number, chartId: number) => Chart | undefined;
  generateAIDashboard: (database: Database, apiKey: string, name?: string) => Promise<Dashboard>;
  exportDashboard: (dashboardId: number, format?: string) => string;
  importDashboard: (file: File) => Promise<Dashboard>;
  clearAllDashboards: () => void;
  getDashboardStats: () => DashboardStats;
  createDefaultDashboard: () => Dashboard | null;
  setSelectedDashboard: (dashboard: Dashboard | null) => void;
  setDashboards: (dashboards: Dashboard[]) => void;
}

export interface DashboardStats {
  totalDashboards: number;
  totalCharts: number;
  avgChartsPerDashboard: string | number;
  chartTypes: Record<string, number>;
  mostRecentUpdate: number | null;
}

export interface UseLocalStorageReturn<T> {
  0: T;
  1: (value: T) => void;
}

// OpenAI API Types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Utility Types
export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type AsyncFunction<T = void> = () => Promise<T>;

export interface DatabaseInfo {
  name: string;
  uploadedAt: string;
  size?: number;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

// Error Types
export interface AppError extends Error {
  code?: string;
  context?: Record<string, any>;
}

// Export utility type helpers
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
