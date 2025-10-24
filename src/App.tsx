import { useState } from 'react'
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
import { useApiKey } from './hooks/useLocalStorage'
import './App.css'

function App() {
  // Use custom hooks for centralized state management
  const { 
    database, 
    sqlInstance, 
    sqlLoading, 
    sqlError, 
    setDatabase 
  } = useDatabase()
  
  const { 
    dashboards, 
    selectedDashboard, 
    setSelectedDashboard, 
    createDashboard,
    setDashboards
  } = useDashboard()
  
  const { apiKey, setApiKey } = useApiKey()
  
  // Local component state
  const [activeTab, setActiveTab] = useState('upload')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleDatabaseLoad = (db: any) => {
    setDatabase(db)
    setActiveTab('aiAssistant')
    // Create default dashboard using the hook
    const defaultDashboard = createDashboard('Pool Service Executive Dashboard', {
      description: 'Executive dashboard for pool service business metrics'
    })
    setSelectedDashboard(defaultDashboard as any)
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
    <div className="min-h-screen bg-gradient-to-br from-pool-blue-50 to-service-100">
      <div className="container mx-auto">
        {/* Header */}
        <header className="bg-white border-b border-service-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-pool-gradient rounded-lg flex items-center justify-center">
                <SafeIcon icon={FiDatabase} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-service-900">Pool Service BI Dashboard</h1>
                <p className="text-sm text-service-600">AI-powered Business Intelligence</p>
              </div>
            </div>
            {database && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-service-600">Database Connected</span>
              </div>
            )}
          </div>
        </header>

        {/* Navigation */}
        <div className="bg-white border-b border-service-200">
          <nav className="px-6">
            <div className="flex space-x-0 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-pool-blue-500 text-pool-blue-600 bg-pool-blue-50'
                      : 'border-transparent text-service-600 hover:text-service-800 hover:border-service-300'
                  }`}
                >
                  <SafeIcon icon={tab.icon} className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[600px]">
          {activeTab === 'upload' && (
            <DatabaseUploader sqlInstance={sqlInstance} onDatabaseLoad={handleDatabaseLoad} />
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
              <h2 className="text-2xl font-bold text-service-900 mb-6">Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-service-700 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey || ''}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your OpenAI API key for AI features"
                    className="w-full p-3 border border-service-300 rounded-lg focus:ring-2 focus:ring-pool-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-service-600 mt-2">
                    Required for AI-powered queries, dashboard generation, and business insights
                  </p>
                </div>
                
                <div className="bg-pool-blue-50 border border-pool-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-pool-blue-900 mb-2">Pool Service Features</h3>
                  <ul className="text-sm text-pool-blue-800 space-y-1">
                    <li>• Customer retention and lifetime value analysis</li>
                    <li>• Route optimization and technician productivity</li>
                    <li>• Revenue trends and seasonal pattern detection</li>
                    <li>• Equipment maintenance and chemical usage tracking</li>
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