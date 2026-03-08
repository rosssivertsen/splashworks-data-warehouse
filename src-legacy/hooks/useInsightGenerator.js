import { useState } from 'react';
import { buildEnhancedSchemaContext } from '../utils/schemaMetadata';
import { getAllBusinessTerms, getAllMetrics } from '../utils/semanticLayer';
import { useAISettings } from './useLocalStorage';
import { aiService } from '../services/aiService';

const useInsightGenerator = (database, apiKey, setIsLoading) => {
  const aiSettings = useAISettings();
  const [insights, setInsights] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsights = async () => {
    const currentApiKey = aiSettings.getCurrentApiKey();
    
    if (!currentApiKey) {
      alert('Please set your AI API key in Settings to use AI insights.');
      return;
    }

    setIsGenerating(true);
    setIsLoading(true);

    try {
      // Get enhanced database schema with relationships, business context, and semantic layer
      let schema;
      let semanticInfo = '';
      try {
        schema = buildEnhancedSchemaContext(database);
        if (!schema || schema.length < 50) {
          throw new Error('Schema context is empty or invalid');
        }
        
        // Add semantic layer context for better insights
        const businessTerms = getAllBusinessTerms();
        const metrics = getAllMetrics();
        
        if (Object.keys(businessTerms).length > 0) {
          semanticInfo += '\n\n=== BUSINESS TERMS & PATTERNS ===\n';
          Object.entries(businessTerms).forEach(([key, term]) => {
            semanticInfo += `\n${key}: ${term.description}`;
            if (term.recurrence) semanticInfo += ` (${term.recurrence})`;
          });
        }
        
        if (Object.keys(metrics).length > 0) {
          semanticInfo += '\n\n=== KEY METRICS ===\n';
          Object.entries(metrics).forEach(([key, metric]) => {
            semanticInfo += `\n${key}: ${metric.description}`;
            if (metric.target) semanticInfo += ` (Target: ${metric.target})`;
            if (metric.data_availability) semanticInfo += ` [${metric.data_availability}]`;
          });
        }
      } catch (error) {
        throw new Error(`Failed to read database schema: ${error.message}`);
      }

      const prompt = `Analyze this pool service business database and provide 5 key business insights that would be valuable for executives.

${schema}
${semanticInfo}

IMPORTANT GUIDANCE:
- Consider the business terms and metrics defined above when generating insights
- Focus on metrics with targets and data availability indicators
- Use the relationship information to create multi-table insights
- Leverage common query patterns shown above
- Focus on revenue, customer value, operational efficiency, and service quality
- Use the foreign key relationships to join tables correctly

For each insight, provide:
1. Title (short, impactful)
2. Description (what the insight means and why it matters)
3. SQL query to verify the insight (MUST use proper JOINs based on foreign keys)
4. Impact level (High/Medium/Low)
5. Insight type (Trend/Anomaly/Opportunity/Warning)

EXAMPLE MULTI-TABLE INSIGHTS:
- Customer lifetime value: JOIN Customer → ServiceLocation → InvoiceLocation → Invoice
- Technician efficiency: JOIN Account → RouteStop → ServiceStop
- Chemical usage trends: JOIN Pool → ServiceStop → ServiceStopEntry → EntryDescription
- Equipment failure patterns: JOIN Pool → EquipmentItem → InstalledItem

Format as JSON array with objects containing: title, description, query, impact, type

Important:
- Return ONLY valid JSON without any explanation or formatting
- SQL queries must be valid SQLite syntax with proper JOINs
- Use the documented foreign key relationships (e.g., CustomerId, ServiceLocationId, PoolId)
- Impact levels must be: High, Medium, or Low
- Insight types must be: Trend, Anomaly, Opportunity, or Warning
- Each object must have all 5 required fields`;

      console.log('Sending insights prompt to AI');

      const systemPrompt = 'You are a business intelligence analyst. Generate actionable insights from database schema. Return valid JSON only.';
      
      // Use AI service abstraction for provider-agnostic insight generation
      const content = await aiService.generateInsights({
        provider: aiSettings.settings.provider,
        apiKey: currentApiKey,
        model: aiSettings.getCurrentModel(),
        prompt: prompt,
        systemPrompt: systemPrompt,
        maxTokens: 1000,
        temperature: 0.3
      });
      console.log('Generated insights content:', content);
      
      // Content is already parsed by aiService.generateInsights()
      const generatedInsights = Array.isArray(content) ? content : [content];
      
      console.log('Parsed insights:', generatedInsights);

      // Test queries and add results
      const insightsWithData = await Promise.all(
        generatedInsights.map(async (insight) => {
          try {
            if (!insight.query || !insight.title) {
              console.warn('Skipping invalid insight:', insight);
              return null;
            }

            const result = database.exec(insight.query);
            if (result.length > 0) {
              return {
                ...insight,
                data: {
                  columns: result[0].columns,
                  values: result[0].values.slice(0, 5) // Limit to first 5 rows
                },
                rowCount: result[0].values.length
              };
            } else {
              console.warn('No data returned for insight query:', insight.query);
              return insight;
            }
          } catch (error) {
            console.error('Error executing insight query:', error, 'Query:', insight.query);
            return insight; // Still return the insight even if query fails
          }
        })
      );

      // Filter out null insights and update state
      const validInsights = insightsWithData.filter(insight => insight !== null);

      if (validInsights.length === 0) {
        throw new Error('No valid insights could be generated');
      }

      setInsights(validInsights);
      console.log(`Successfully generated ${validInsights.length} insights`);
    } catch (error) {
      console.error('Error generating insights:', error);
      alert(`Failed to generate insights: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  return {
    insights,
    setInsights,
    isGenerating,
    generateInsights
  };
};

export default useInsightGenerator;
