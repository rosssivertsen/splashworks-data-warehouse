import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { 
  textStyles, 
  presetStyles, 
  backgroundStyles, 
  cn,
  layoutStyles
} from '../styles/themeUtils';

const { FiInfo } = FiIcons;

const InsightEmptyState = ({ onGenerateInsights, isGenerating, apiKey }) => {
  return (
    <div className={cn('text-center py-16 rounded-lg', backgroundStyles.gray)}>
      <SafeIcon icon={FiInfo} className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
      <h3 className={cn(textStyles.h5, 'mb-2')}>No insights yet</h3>
      <p className={cn(textStyles.bodySmall, 'mb-6')}>
        Generate AI-powered insights to discover trends and opportunities in your data
      </p>
      <button
        onClick={onGenerateInsights}
        disabled={isGenerating || !apiKey}
        className={cn(
          presetStyles.button.primary,
          'px-6 py-3',
          'disabled:bg-neutral-300 disabled:cursor-not-allowed'
        )}
      >
        {isGenerating ? 'Generating...' : 'Generate Insights'}
      </button>
    </div>
  );
};

export default InsightEmptyState;