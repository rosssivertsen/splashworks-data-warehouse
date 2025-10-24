import { useState } from 'react'
import { motion } from 'framer-motion'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-pool-blue-50 to-service-100">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-pool-blue-900 mb-4">
            Pool Service BI Dashboard
          </h1>
          <p className="text-lg text-service-600 mb-8">
            AI-powered Business Intelligence for Pool Service Management
          </p>
          
          <div className="service-card max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
            <p className="text-service-600 mb-6">
              Upload your pool service database to begin analyzing your business data with AI-powered insights.
            </p>
            
            <div className="space-y-4">
              <button className="btn-primary w-full">
                Upload Database
              </button>
              <button 
                className="btn-secondary w-full"
                onClick={() => setCount(count + 1)}
              >
                Demo Mode (clicks: {count})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="service-card">
              <div className="text-pool-blue-600 text-2xl mb-2">🏊‍♂️</div>
              <h3 className="font-semibold mb-2">Customer Analytics</h3>
              <p className="text-sm text-service-600">
                Track customer retention, service frequency, and geographic distribution
              </p>
            </div>
            
            <div className="service-card">
              <div className="text-pool-blue-600 text-2xl mb-2">🚗</div>
              <h3 className="font-semibold mb-2">Route Optimization</h3>
              <p className="text-sm text-service-600">
                Analyze technician productivity and optimize service routes
              </p>
            </div>
            
            <div className="service-card">
              <div className="text-pool-blue-600 text-2xl mb-2">💰</div>
              <h3 className="font-semibold mb-2">Revenue Insights</h3>
              <p className="text-sm text-service-600">
                Monitor financial performance and identify growth opportunities
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default App