import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import QueryResults from './QueryResults';

const { FiX } = FiIcons;

const InsightModal = ({ insightResults, onClose }) => {
  if (!insightResults) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Insight Data Results</h3>
            <p className="text-sm text-gray-600 mt-1">
              {insightResults.originalQuestion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <SafeIcon icon={FiX} className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <QueryResults results={insightResults} />
        </div>
      </div>
    </div>
  );
};

export default InsightModal;