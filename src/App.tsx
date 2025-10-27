import { useState, useEffect } from 'react'
import DatabaseUploader from './components/DatabaseUploader'
import DatabaseExplorer from './components/DatabaseExplorer'
import DashboardView from './components/DashboardView'
import DataExplorer from './components/DataExplorer'
import InsightsPanel from './components/InsightsPanel'
import QueryResults from './components/QueryResults'
import AIQueryInterface from './components/AIQueryInterface'
import AIAssistant from './components/AIAssistant'
import { FiDatabase, FiBarChart2, FiPieChart, FiSearch, FiTrendingUp, FiSettings, FiMessageSquare, FiCpu } from 'react-icons/fi'
import SafeIcon from './common/SafeIcon'
import useDatabase from './hooks/useDatabase'
import useDashboard from './hooks/useDashboard'
import { useAISettings } from './hooks/useLocalStorage'
import { AI_PROVIDERS, MODELS, getProviderName } from './services/aiService'
import './App.css'

function App() {
  // Use custom hooks for centralized state management
  const { 
    database, 
    sqlInstance, 
    sqlLoading, 
    sqlError, 
    setDatabase,
    handleDatabaseUpload
  } = useDatabase()
  
  const { 
    dashboards, 
    selectedDashboard, 
    setSelectedDashboard, 
    createDashboard,
    setDashboards
  } = useDashboard()
  
  const aiSettings = useAISettings()
  
  // For backward compatibility with components that expect apiKey
  const apiKey = aiSettings.getCurrentApiKey()
  
  // Local component state
  const [activeTab, setActiveTab] = useState('upload')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Handle initial dashboard restoration - run only when dashboard/database state changes, NOT on tab changes
  useEffect(() => {
    console.log('🎯 App useEffect: Checking dashboard restoration conditions');
    console.log('🎯 App useEffect: database exists?', !!database);
    console.log('🎯 App useEffect: selectedDashboard exists?', !!selectedDashboard);
    console.log('🎯 App useEffect: dashboards.length:', dashboards.length);
    
    // Handle dashboard creation when database is loaded but no dashboard exists
    if (database && !selectedDashboard && dashboards.length === 0) {
      console.log('🎯 App useEffect: Database loaded but no dashboards exist, creating default');
      const defaultDashboard = createDashboard('Pool Service Executive Dashboard', {
        description: 'Executive dashboard for pool service business metrics (restored)'
      })
      setSelectedDashboard(defaultDashboard as any)
      setActiveTab('aiAssistant')
    }
  }, [database, selectedDashboard, dashboards.length, sqlInstance, createDashboard, setSelectedDashboard, setActiveTab])

  // Handle initial tab switching when app loads - run only once on mount
  useEffect(() => {
    // Only auto-switch tabs on initial load if we have persisted dashboards
    if (selectedDashboard && dashboards.length > 0 && activeTab === 'upload') {
      console.log('🎯 App initial load: Selected dashboard exists, switching to dashboard tab');
      setActiveTab('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run on mount, not when activeTab changes

  const handleDatabaseLoad = (db: any) => {
    console.log('🎯 App: Database loaded, switching to AI Assistant tab and creating dashboard');
    console.log('🎯 App: Current dashboards length:', dashboards.length);
    console.log('🎯 App: Current selected dashboard:', selectedDashboard);
    
    setDatabase(db)
    setActiveTab('aiAssistant')
    // Create default dashboard using the hook
    const defaultDashboard = createDashboard('Pool Service Executive Dashboard', {
      description: 'Executive dashboard for pool service business metrics'
    })
    console.log('🎯 App: Created dashboard:', defaultDashboard);
    setSelectedDashboard(defaultDashboard as any)
  }

  const handleFileUpload = async (file: File) => {
    try {
      const db = await handleDatabaseUpload(file)
      handleDatabaseLoad(db)
    } catch (error) {
      console.error('Failed to upload database:', error)
    }
  }

  const handleQueryExecute = (results: any) => {
    setQueryResults(results)
  }

  const tabs = [
    { id: 'upload', label: 'Upload Database', icon: FiDatabase },
    { id: 'explorer', label: 'Database Explorer', icon: FiBarChart2 },
    { id: 'dataExplorer', label: 'Data Explorer', icon: FiPieChart },
    { id: 'aiQuery', label: 'AI Query Interface', icon: FiSearch },
    { id: 'insights', label: 'Business Insights', icon: FiTrendingUp },
    { id: 'dashboard', label: 'Executive Dashboard', icon: FiMessageSquare },
    { id: 'aiAssistant', label: 'AI Assistant', icon: FiCpu },
    { id: 'settings', label: 'Settings', icon: FiSettings },
  ]

  if (sqlLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pool-blue-50 to-service-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pool-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-service-700">Loading Pool Service BI Dashboard...</p>
        </div>
      </div>
    )
  }

  if (sqlError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pool-blue-50 to-service-100 flex items-center justify-center">
        <div className="service-card max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Initialization Error</h2>
          <p className="text-service-600 mb-4">Failed to load SQL.js library:</p>
          <p className="text-sm bg-red-50 p-3 rounded text-red-700">{sqlError}</p>
          <button 
            className="btn-primary w-full mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto" style={{ maxWidth: '1400px' }}>
        {/* Header - 80px desktop, 64px tablet, 56px mobile */}
        <header className="bg-white border-b border-neutral-200 px-8 md:px-6 lg:px-8 h-14 md:h-16 lg:h-20 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <SafeIcon icon={FiDatabase} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-neutral-900">Pool Service BI Dashboard</h1>
                <p className="text-xs md:text-sm text-neutral-600">AI-powered Business Intelligence</p>
              </div>
            </div>
            {database && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                <span className="text-neutral-600">Database Connected</span>
              </div>
            )}
          </div>
        </header>

        {/* Navigation - 64px desktop, 56px tablet/mobile */}
        <div className="bg-white border-b border-neutral-200">
          <nav className="px-8 md:px-6 lg:px-8">
            <div className="flex space-x-0 overflow-x-auto h-14 lg:h-16">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600 bg-primary-50'
                      : 'border-transparent text-neutral-600 hover:text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <SafeIcon icon={tab.icon} className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Tab Content - Responsive padding: 24px desktop, 16px tablet, 12px mobile */}
        <div className="p-3 md:p-4 lg:p-6 min-h-[600px]">
          {activeTab === 'upload' && (
            <DatabaseUploader 
              sqlInstance={sqlInstance} 
              onDatabaseLoad={handleDatabaseLoad} 
              onFileUpload={handleFileUpload}
            />
          )}
          {activeTab === 'explorer' && database && (
            <DatabaseExplorer database={database} onQueryExecute={handleQueryExecute} />
          )}
          {activeTab === 'aiAssistant' && database && (
            <AIAssistant
              database={database}
              apiKey={apiKey}
              onQueryExecute={handleQueryExecute}
              dashboards={dashboards}
              setDashboards={setDashboards}
              selectedDashboard={selectedDashboard}
              setSelectedDashboard={setSelectedDashboard}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {activeTab === 'aiQuery' && database && (
            <AIQueryInterface
              database={database}
              apiKey={apiKey}
              onQueryExecute={handleQueryExecute}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {activeTab === 'dashboard' && database && (
            <DashboardView
              database={database}
              dashboards={dashboards}
              setDashboards={setDashboards}
              selectedDashboard={selectedDashboard}
              setSelectedDashboard={setSelectedDashboard}
              apiKey={apiKey}
              onQueryExecute={handleQueryExecute}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {activeTab === 'insights' && database && (
            <InsightsPanel
              database={database}
              apiKey={apiKey}
              onQueryExecute={handleQueryExecute}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
          {activeTab === 'dataExplorer' && database && (
            <DataExplorer
              database={database}
              onQueryExecute={handleQueryExecute}
            />
          )}
          {activeTab === 'settings' && (
            <div className="service-card max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-service-900 mb-6">AI Provider Settings</h2>
              <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-service-700 mb-2">
                    AI Provider
                  </label>
                  <select
                    value={aiSettings.settings.provider}
                    onChange={(e) => aiSettings.setProvider(e.target.value)}
                    className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                  >
                    <option value={AI_PROVIDERS.OPENAI}>{getProviderName(AI_PROVIDERS.OPENAI)}</option>
                    <option value={AI_PROVIDERS.ANTHROPIC}>{getProviderName(AI_PROVIDERS.ANTHROPIC)}</option>
                  </select>
                  <p className="text-sm text-service-600 mt-2">
                    Select your preferred AI provider for SQL generation
                  </p>
                </div>

                {/* OpenAI Settings */}
                {aiSettings.settings.provider === AI_PROVIDERS.OPENAI && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-service-700 mb-2">
                        OpenAI API Key
                      </label>
                      <input
                        type="password"
                        value={aiSettings.settings.openaiApiKey || ''}
                        onChange={(e) => aiSettings.setOpenAIKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                      />
                      {aiSettings.isValidOpenAIKey && (
                        <p className="text-sm text-success-600 mt-1">✓ Valid API key format</p>
                      )}
                      {aiSettings.settings.openaiApiKey && !aiSettings.isValidOpenAIKey && (
                        <p className="text-sm text-error-600 mt-1">⚠ Invalid API key format (should start with sk-)</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-service-700 mb-2">
                        OpenAI Model
                      </label>
                      <select
                        value={aiSettings.settings.openaiModel}
                        onChange={(e) => aiSettings.setOpenAIModel(e.target.value)}
                        className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                      >
                        {MODELS.openai.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Anthropic Settings */}
                {aiSettings.settings.provider === AI_PROVIDERS.ANTHROPIC && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-service-700 mb-2">
                        Anthropic API Key
                      </label>
                      <input
                        type="password"
                        value={aiSettings.settings.anthropicApiKey || ''}
                        onChange={(e) => aiSettings.setAnthropicKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                      />
                      {aiSettings.isValidAnthropicKey && (
                        <p className="text-sm text-success-600 mt-1">✓ Valid API key format</p>
                      )}
                      {aiSettings.settings.anthropicApiKey && !aiSettings.isValidAnthropicKey && (
                        <p className="text-sm text-error-600 mt-1">⚠ Invalid API key format (should start with sk-ant-)</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-service-700 mb-2">
                        Anthropic Model
                      </label>
                      <select
                        value={aiSettings.settings.anthropicModel}
                        onChange={(e) => aiSettings.setAnthropicModel(e.target.value)}
                        className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                      >
                        {MODELS.anthropic.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-pool-blue-600 mt-2">
                        💡 <strong>Recommended:</strong> Claude 3.5 Sonnet excels at SQL generation
                      </p>
                    </div>
                  </>
                )}
                
                <div className="bg-pool-blue-50 border border-pool-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-pool-blue-900 mb-2">Pool Service Features</h3>
                  <ul className="text-sm text-pool-blue-800 space-y-1">
                    <li>• Customer retention and lifetime value analysis</li>
                    <li>• Route optimization and technician productivity</li>
                    <li>• Revenue trends and seasonal pattern detection</li>
                    <li>• Equipment maintenance and chemical usage tracking</li>
                  </ul>
                </div>

                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <h3 className="font-medium text-success-900 mb-2">✨ New: Semantic Layer Integration</h3>
                  <p className="text-sm text-success-800 mb-2">
                    The AI now understands business concepts like "filter cleaning" and "chlorine usage" 
                    with proper SQL patterns and recurrence schedules.
                  </p>
                  <ul className="text-sm text-success-800 space-y-1">
                    <li>• Business term recognition with synonyms</li>
                    <li>• Metric awareness (targets & compliance rates)</li>
                    <li>• Pre-validated query templates</li>
                    <li>• Improved multi-table JOIN accuracy</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Query Results */}
          {queryResults && (
            <div className="mt-8">
              <QueryResults results={queryResults} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
