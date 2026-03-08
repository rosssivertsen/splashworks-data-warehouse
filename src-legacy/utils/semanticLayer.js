/**
 * Semantic Layer Integration
 * 
 * This module loads and processes the semantic layer YAML configuration
 * to provide business context, metrics, and query patterns for AI-assisted queries.
 * 
 * Features:
 * - Business term mapping with synonyms
 * - Pre-validated query patterns
 * - Metric definitions with targets
 * - Data availability indicators
 * - Recurrence patterns for scheduled tasks
 */

import yaml from 'js-yaml';

// Semantic layer data (loaded from YAML)
let semanticLayerData = null;

/**
 * Load semantic layer from YAML file
 * @returns {Promise<Object>} - Parsed semantic layer data
 */
export async function loadSemanticLayer() {
  if (semanticLayerData) {
    return semanticLayerData;
  }

  try {
    const response = await fetch('/docs/skimmer-semantic-layer.yaml');
    const yamlText = await response.text();
    semanticLayerData = yaml.load(yamlText);
    return semanticLayerData;
  } catch (error) {
    console.error('Error loading semantic layer:', error);
    return null;
  }
}

/**
 * Get business term definition
 * @param {string} term - Business term to look up
 * @returns {Object|null} - Business term definition or null
 */
export function getBusinessTerm(term) {
  if (!semanticLayerData?.business_terms) return null;
  
  const lowerTerm = term.toLowerCase().replace(/\s+/g, '_');
  
  // Direct match
  if (semanticLayerData.business_terms[lowerTerm]) {
    return semanticLayerData.business_terms[lowerTerm];
  }
  
  // Check synonyms
  for (const [key, value] of Object.entries(semanticLayerData.business_terms)) {
    if (value.synonyms && value.synonyms.some(syn => 
      syn.toLowerCase().includes(term.toLowerCase()) || 
      term.toLowerCase().includes(syn.toLowerCase())
    )) {
      return value;
    }
  }
  
  return null;
}

/**
 * Get metric definition
 * @param {string} metricName - Metric to look up
 * @returns {Object|null} - Metric definition or null
 */
export function getMetric(metricName) {
  if (!semanticLayerData?.metrics) return null;
  
  const lowerMetric = metricName.toLowerCase().replace(/\s+/g, '_');
  return semanticLayerData.metrics[lowerMetric] || null;
}

/**
 * Find relevant business terms based on question
 * @param {string} question - User's natural language question
 * @returns {Array} - Array of matching business terms with their definitions
 */
export function findRelevantBusinessTerms(question) {
  if (!semanticLayerData?.business_terms) return [];
  
  const lowerQuestion = question.toLowerCase();
  const matches = [];
  
  for (const [key, value] of Object.entries(semanticLayerData.business_terms)) {
    // Check if term appears in question
    if (lowerQuestion.includes(key.replace(/_/g, ' '))) {
      matches.push({ key, ...value });
      continue;
    }
    
    // Check synonyms
    if (value.synonyms && value.synonyms.some(syn => 
      lowerQuestion.includes(syn.toLowerCase())
    )) {
      matches.push({ key, ...value });
    }
  }
  
  return matches;
}

/**
 * Find relevant metrics based on question
 * @param {string} question - User's natural language question
 * @returns {Array} - Array of matching metrics with their definitions
 */
export function findRelevantMetrics(question) {
  if (!semanticLayerData?.metrics) return [];
  
  const lowerQuestion = question.toLowerCase();
  const matches = [];
  
  for (const [key, value] of Object.entries(semanticLayerData.metrics)) {
    const metricName = key.replace(/_/g, ' ');
    
    // Check if metric appears in question
    if (lowerQuestion.includes(metricName) || 
        lowerQuestion.includes(value.description?.toLowerCase())) {
      matches.push({ key, ...value });
    }
  }
  
  return matches;
}

/**
 * Get verified query by question match
 * @param {string} question - User's natural language question
 * @returns {Object|null} - Verified query or null
 */
export function getVerifiedQuery(question) {
  if (!semanticLayerData?.verified_queries) return null;
  
  const lowerQuestion = question.toLowerCase();
  
  // Find best matching verified query
  for (const verifiedQuery of semanticLayerData.verified_queries) {
    const queryQuestion = verifiedQuery.question.toLowerCase();
    
    // Check for significant word overlap
    const questionWords = lowerQuestion.split(/\s+/).filter(w => w.length > 3);
    const queryWords = queryQuestion.split(/\s+/).filter(w => w.length > 3);
    
    const matchCount = questionWords.filter(word => 
      queryWords.some(qWord => qWord.includes(word) || word.includes(qWord))
    ).length;
    
    // If more than 50% of significant words match, consider it a match
    if (matchCount >= Math.min(questionWords.length, queryWords.length) * 0.5) {
      return verifiedQuery;
    }
  }
  
  return null;
}

/**
 * Build enhanced context string for AI with semantic layer data
 * @param {string} question - User's question for context
 * @returns {string} - Enhanced context with business terms and metrics
 */
export function buildSemanticContext(question) {
  let context = '\n=== SEMANTIC LAYER CONTEXT ===\n\n';
  
  // Add relevant business terms
  const businessTerms = findRelevantBusinessTerms(question);
  if (businessTerms.length > 0) {
    context += 'Relevant Business Terms:\n';
    businessTerms.forEach(term => {
      context += `\n${term.key.replace(/_/g, ' ').toUpperCase()}:\n`;
      context += `  Description: ${term.description}\n`;
      if (term.sql_pattern) {
        context += `  SQL Pattern:\n${term.sql_pattern}\n`;
      }
      if (term.tables_required) {
        context += `  Tables Required: ${term.tables_required.join(', ')}\n`;
      }
      if (term.unit) {
        context += `  Unit: ${term.unit}\n`;
      }
      if (term.synonyms) {
        context += `  Also known as: ${term.synonyms.join(', ')}\n`;
      }
      if (term.recurrence) {
        context += `  Recurrence: ${term.recurrence}\n`;
      }
    });
    context += '\n';
  }
  
  // Add relevant metrics
  const metrics = findRelevantMetrics(question);
  if (metrics.length > 0) {
    context += 'Relevant Metrics:\n';
    metrics.forEach(metric => {
      context += `\n${metric.key.replace(/_/g, ' ').toUpperCase()}:\n`;
      context += `  Description: ${metric.description}\n`;
      if (metric.formula) {
        context += `  Formula: ${metric.formula}\n`;
      }
      if (metric.target) {
        context += `  Target: ${metric.target}\n`;
      }
      if (metric.unit) {
        context += `  Unit: ${metric.unit}\n`;
      }
      if (metric.data_availability) {
        context += `  Data Availability: ${metric.data_availability}\n`;
      }
    });
    context += '\n';
  }
  
  // Check for verified query
  const verifiedQuery = getVerifiedQuery(question);
  if (verifiedQuery) {
    context += 'VERIFIED QUERY AVAILABLE:\n';
    context += `  Question: ${verifiedQuery.question}\n`;
    context += `  Data Availability: ${verifiedQuery.data_availability}\n`;
    context += `  SQL Query:\n${verifiedQuery.sql_query}\n`;
    if (verifiedQuery.business_logic) {
      context += `  Business Logic:\n`;
      verifiedQuery.business_logic.forEach(rule => {
        context += `    - ${rule}\n`;
      });
    }
    context += '\n';
  }
  
  return context;
}

/**
 * Get all business terms for reference
 * @returns {Object} - All business terms
 */
export function getAllBusinessTerms() {
  return semanticLayerData?.business_terms || {};
}

/**
 * Get all metrics for reference
 * @returns {Object} - All metrics
 */
export function getAllMetrics() {
  return semanticLayerData?.metrics || {};
}

/**
 * Get all verified queries for reference
 * @returns {Array} - All verified queries
 */
export function getAllVerifiedQueries() {
  return semanticLayerData?.verified_queries || [];
}

/**
 * Check if data is available for a specific query need
 * @param {Array} tablesRequired - Tables needed for the query
 * @returns {Object} - Availability status and notes
 */
export function checkDataAvailability(tablesRequired) {
  // Check if tables exist in semantic layer
  const availableTables = semanticLayerData?.tables || {};
  const missingTables = tablesRequired.filter(table => !availableTables[table]);
  
  return {
    available: missingTables.length === 0,
    missingTables,
    notes: missingTables.length > 0 
      ? `Missing tables: ${missingTables.join(', ')}` 
      : 'All required tables available'
  };
}

/**
 * Get LSI calculation information
 * @returns {Object|null} - LSI calculation details or null
 */
export function getLSICalculation() {
  return semanticLayerData?.lsi_calculation || null;
}

// Initialize semantic layer on module load
loadSemanticLayer().catch(err => {
  console.error('Failed to initialize semantic layer:', err);
});
