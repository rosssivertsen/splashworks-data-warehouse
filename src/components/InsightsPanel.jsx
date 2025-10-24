import React, { useState } from 'react';
    import InsightsFormatter from './InsightsFormatter';
    import InsightHeader from './InsightHeader';
    import InsightEmptyState from './InsightEmptyState';
    import InsightCard from './InsightCard';
    import InsightModal from './InsightModal';
    import useInsightGenerator from '../hooks/useInsightGenerator';

    const InsightsPanel = ({
      database,
      apiKey,
      onQueryExecute,
      isLoading,
      setIsLoading
    }) => {
      const { insights, setInsights, isGenerating, generateInsights } = useInsightGenerator(database, apiKey, setIsLoading);
      const [isFormatting, setIsFormatting] = useState(false);
      const [selectedInsight, setSelectedInsight] = useState(null);
      const [insightResults, setInsightResults] = useState(null);
      const [copiedQuery, setCopiedQuery] = useState(null);





      const handleViewData = (insight) => {
        if (insight.query) {
          try {
            const result = database.exec(insight.query);
            if (result.length > 0) {
              const queryResults = {
                query: insight.query,
                columns: result[0].columns,
                values: result[0].values,
                rowCount: result[0].values.length,
                originalQuestion: insight.title
              };
              setInsightResults(queryResults);
              onQueryExecute(queryResults);
            } else {
              const emptyResults = {
                query: insight.query,
                columns: [],
                values: [],
                rowCount: 0,
                message: 'Query executed successfully but returned no data',
                originalQuestion: insight.title
              };
              setInsightResults(emptyResults);
              onQueryExecute(emptyResults);
            }
          } catch (error) {
            alert('Error executing query: ' + error.message);
          }
        }
      };

      const handleCopyQuery = async (text, type) => {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedQuery(type);
          setTimeout(() => setCopiedQuery(null), 2000);
        } catch (err) {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopiedQuery(type);
          setTimeout(() => setCopiedQuery(null), 2000);
        }
      };

      const handleCloseInsightResults = () => {
        setInsightResults(null);
      };

      if (isFormatting) {
        return (
          <InsightsFormatter
            insights={insights}
            setInsights={setInsights}
            onClose={() => setIsFormatting(false)}
          />
        );
      }

      return (
        <div className="space-y-6">
          <InsightHeader
            insights={insights}
            isGenerating={isGenerating}
            apiKey={apiKey}
            onGenerateInsights={generateInsights}
            onToggleFormatting={() => setIsFormatting(true)}
          />

          <InsightModal
            insightResults={insightResults}
            onClose={handleCloseInsightResults}
          />

          {insights.length === 0 ? (
            <InsightEmptyState
              onGenerateInsights={generateInsights}
              isGenerating={isGenerating}
              apiKey={apiKey}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {insights.map((insight, index) => (
                <InsightCard
                  key={index}
                  insight={insight}
                  index={index}
                  isSelected={selectedInsight === index}
                  onSelect={setSelectedInsight}
                  onCopyQuery={handleCopyQuery}
                  onViewData={handleViewData}
                  copiedQuery={copiedQuery}
                />
              ))}
            </div>
          )}
        </div>
      );
    };

    export default InsightsPanel;