import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import InsightExport from './InsightExport';
import { 
  textStyles, 
  presetStyles, 
  backgroundStyles, 
  cn,
  layoutStyles
} from '../styles/themeUtils';

const { FiRefreshCw, FiLayout, FiFileText } = FiIcons;

const InsightHeader = ({ 
  insights, 
  isGenerating, 
  apiKey,
  onGenerateInsights, 
  onToggleFormatting 
}) => {
  const { exportInsightsToPDF } = InsightExport({ insights });

  return (
    <div className={layoutStyles.flexBetween}>
      <div>
        <h2 className={textStyles.h2}>AI Business Insights</h2>
        <p className={cn(textStyles.bodySmall, 'mt-1')}>
          Automated analysis and recommendations based on your data
        </p>
      </div>
      <div className="flex space-x-3">
        {insights.length > 0 && (
          <div className={cn('flex rounded-lg p-1', backgroundStyles.gray)}>
            <button
              onClick={exportInsightsToPDF}
              className={cn(
                'px-3 py-3 rounded-md text-sm transition-colors',
                'hover:bg-white hover:shadow-sm'
              )}
              title="Export Insights as PDF"
            >
              <SafeIcon icon={FiFileText} className="w-5 h-5" />
            </button>
          </div>
        )}
        {insights.length > 0 && (
          <button
            onClick={onToggleFormatting}
            className={cn(
              presetStyles.button.secondary,
              'px-6 py-3 flex items-center space-x-2'
            )}
          >
            <SafeIcon icon={FiLayout} className="w-5 h-5" />
            <span>Format</span>
          </button>
        )}
        <button
          onClick={onGenerateInsights}
          disabled={isGenerating || !apiKey}
          className={cn(
            presetStyles.button.primary,
            'px-6 py-3 flex items-center space-x-2',
            'disabled:bg-neutral-300 disabled:cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <SafeIcon icon={FiRefreshCw} className="w-5 h-5" />
          )}
          <span>{isGenerating ? 'Analyzing...' : 'Generate Insights'}</span>
        </button>
      </div>
    </div>
  );
};

export default InsightHeader;