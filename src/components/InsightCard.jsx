import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { 
  textStyles, 
  presetStyles, 
  backgroundStyles, 
  borderStyles,
  shadowStyles,
  cn 
} from '../styles/themeUtils';

const { FiTrendingUp, FiTrendingDown, FiAlertCircle, FiInfo, FiCopy, FiEye } = FiIcons;

const InsightCard = ({ 
  insight, 
  index, 
  isSelected, 
  onSelect,
  onCopyQuery,
  onViewData,
  copiedQuery 
}) => {
  const getInsightIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'trend': return FiTrendingUp;
      case 'anomaly': return FiAlertCircle;
      case 'opportunity': return FiTrendingUp;
      case 'warning': return FiTrendingDown;
      default: return FiInfo;
    }
  };

  const getImpactColor = (impact) => {
    switch (impact?.toLowerCase()) {
      case 'high': return presetStyles.badge.error;
      case 'medium': return presetStyles.badge.warning;
      case 'low': return presetStyles.badge.success;
      default: return presetStyles.badge.neutral;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        presetStyles.card.interactive,
        'transition-all duration-200',
        isSelected ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-md'
      )}
      onClick={() => onSelect(isSelected ? null : index)}
    >
      {/* Insight Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <SafeIcon
            icon={getInsightIcon(insight.type)}
            className={cn(
              'w-5 h-5',
              insight.type === 'warning' ? textStyles.error : textStyles.info
            )}
          />
          <div>
            <h4 className={textStyles.h6}>{insight.title}</h4>
            <span className={cn(getImpactColor(insight.impact), 'mt-1')}>
              {insight.impact} Impact
            </span>
          </div>
        </div>
      </div>

      {/* Insight Description */}
      <p className={cn(textStyles.bodySmall, 'mb-4')}>{insight.description}</p>

      {/* Data Preview */}
      {insight.data && (
        <div className={cn(backgroundStyles.gray, 'rounded-lg p-3 mb-3')}>
          <div className={cn(textStyles.caption, 'mb-2')}>
            Sample Data ({insight.rowCount} total rows)
          </div>
          <div className={textStyles.caption}>
            {insight.data.values.slice(0, 3).map((row, i) => (
              <div key={i} className="flex space-x-2">
                {row.map((cell, j) => (
                  <span key={j} className={textStyles.bodySmall}>
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <span className={cn(textStyles.caption, 'capitalize')}>{insight.type} Insight</span>
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopyQuery(insight.query, `query-${index}`);
            }}
            className={cn(
              presetStyles.button.ghost,
              'text-sm px-3 py-1 flex items-center space-x-1'
            )}
            title="Copy SQL Query"
          >
            <SafeIcon icon={FiCopy} className="w-3 h-3" />
            <span>{copiedQuery === `query-${index}` ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewData(insight);
            }}
            className={cn(
              presetStyles.button.primary,
              'text-sm px-3 py-1 flex items-center space-x-1'
            )}
            title="View Full Data"
          >
            <SafeIcon icon={FiEye} className="w-3 h-3" />
            <span>View Data</span>
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={cn('mt-4 pt-4', borderStyles.light, 'border-t')}
        >
          <div className={textStyles.caption}>
            <div className="flex items-center justify-between mb-2">
              <strong>SQL Query:</strong>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyQuery(insight.query, `expanded-query-${index}`);
                }}
                className={cn(textStyles.link, 'flex items-center space-x-1')}
                title="Copy SQL Query"
              >
                <SafeIcon icon={FiCopy} className="w-3 h-3" />
                <span>{copiedQuery === `expanded-query-${index}` ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <pre className={cn('mt-1 p-2 rounded overflow-x-auto', backgroundStyles.gray)}>
              {insight.query}
            </pre>
          </div>
          
          {insight.data && (
            <div className={cn('mt-3', textStyles.caption)}>
              <div className="flex items-center justify-between mb-2">
                <strong>Database Schema Used:</strong>
                <span className={textStyles.caption}>{insight.data.columns.length} columns</span>
              </div>
              <div className={cn(backgroundStyles.gray, 'rounded p-2')}>
                <div className="font-mono text-xs">
                  {insight.data.columns.map((col, i) => (
                    <span key={i} className={cn(presetStyles.badge.info, 'mr-2 mb-1')}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default InsightCard;