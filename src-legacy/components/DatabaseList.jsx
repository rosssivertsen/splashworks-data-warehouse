import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiDatabase, FiLink, FiCheck, FiClock, FiTrash2 } = FiIcons;

const DatabaseList = ({ databases = [], onRemove }) => {
  if (databases.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Connected Databases
        </h3>
        <span className="text-sm text-gray-500">
          {databases.length} database{databases.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {databases.map((db, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100"
          >
            <div className="flex items-center space-x-3 flex-1">
              <SafeIcon 
                icon={db.isUnion ? FiLink : FiDatabase} 
                className={`w-5 h-5 ${db.isUnion ? 'text-purple-500' : 'text-blue-500'}`} 
              />
              
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900">{db.name}</h4>
                  {db.isActive && (
                    <span className="flex items-center space-x-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                      <SafeIcon icon={FiCheck} className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center space-x-1">
                    <SafeIcon icon={FiClock} className="w-3 h-3" />
                    <span>{new Date(db.uploadedAt).toLocaleString()}</span>
                  </span>
                  
                  {db.isUnion && (
                    <span className="text-purple-600 font-medium">
                      Union of {db.unionCount} databases
                    </span>
                  )}
                  
                  {db.tableCount && (
                    <span className="text-gray-500">
                      {db.tableCount} tables
                    </span>
                  )}
                </div>
              </div>
            </div>

            {onRemove && !db.isActive && (
              <button
                onClick={() => onRemove(index)}
                className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove database"
              >
                <SafeIcon icon={FiTrash2} className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default DatabaseList;
