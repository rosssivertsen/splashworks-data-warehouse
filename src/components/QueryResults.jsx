import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';
    import { formatDateToISO } from '../utils/dateUtils';

    const { FiTable, FiDownload, FiCode, FiGrid, FiFileText } = FiIcons;

    const QueryResults = ({ results }) => {
      const [viewMode, setViewMode] = useState('table');
      const [currentPage, setCurrentPage] = useState(1);
      const [isExporting, setIsExporting] = useState(false);
      const itemsPerPage = 50;

      if (!results) return null;

      const { query, columns, values, rowCount, message, originalQuestion } = results;
      const totalPages = Math.ceil(values.length / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const currentData = values.slice(startIndex, endIndex);

      const exportToCSV = async () => {
        if (!columns || !values || values.length === 0) {
          alert('No data available to export');
          return;
        }

        setIsExporting(true);
        
        try {
          // Create CSV content
          const csvRows = [];
          
          // Add header row
          csvRows.push(columns.map(col => `"${col.replace(/"/g, '""')}"`).join(','));
          
          // Add data rows
          values.forEach(row => {
            const csvRow = row.map(cell => {
              if (cell === null || cell === undefined) {
                return '""';
              }
              const cellStr = String(cell);
              // Escape quotes and wrap in quotes if needed
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return `"${cellStr}"`;
            });
            csvRows.push(csvRow.join(','));
          });

          const csvContent = csvRows.join('\n');
          
          // Add BOM for proper UTF-8 handling in Excel
          const BOM = '\uFEFF';
          const csvContentWithBOM = BOM + csvContent;
          
          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `query_results_${timestamp}.csv`;
          
          // Create blob with proper MIME type
          const blob = new Blob([csvContentWithBOM], { 
            type: 'text/csv;charset=utf-8;' 
          });
          
          // Use the modern File System Access API if available (for better browser support)
          if ('showSaveFilePicker' in window) {
            try {
              const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                  description: 'CSV files',
                  accept: { 'text/csv': ['.csv'] },
                }],
              });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              console.log('File saved successfully using File System Access API');
              return;
            } catch (err) {
              if (err.name !== 'AbortError') {
                console.log('File System Access API not available, falling back to download link');
              }
            }
          }
          
          // Fallback method: Create download link
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          
          // Set link attributes
          downloadLink.href = url;
          downloadLink.download = filename;
          downloadLink.style.display = 'none';
          
          // Add to DOM and trigger download
          document.body.appendChild(downloadLink);
          
          // Multiple click attempts for better compatibility
          downloadLink.click();
          
          // Also try dispatching a click event
          const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          downloadLink.dispatchEvent(event);
          
          // Wait and cleanup
          setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
          }, 100);
          
          console.log('CSV export initiated:', filename);
          
        } catch (error) {
          console.error('Error exporting CSV:', error);
          alert(`Failed to export CSV: ${error.message}`);
        } finally {
          setIsExporting(false);
        }
      };

      const exportToPDF = async () => {
        if (!columns || !values || values.length === 0) {
          alert('No data available to export');
          return;
        }

        setIsExporting(true);
        
        try {
          // Dynamically import jsPDF
          const { jsPDF } = await import('jspdf');
          
          // Create new jsPDF instance with better configuration
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          // Set font to support UTF-8 characters
          doc.setFont('helvetica');

          // Add title
          doc.setFontSize(18);
          doc.setTextColor(40, 40, 40);
          doc.text('Query Results Report', 20, 20);
          
          // Add timestamp
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

          let yPosition = 45;

          // Add original question if available
          if (originalQuestion) {
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text('Question:', 20, yPosition);
            yPosition += 7;
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            const questionLines = doc.splitTextToSize(originalQuestion, 170);
            doc.text(questionLines, 20, yPosition);
            yPosition += questionLines.length * 5 + 5;
          }

          // Add query
          doc.setFontSize(12);
          doc.setTextColor(60, 60, 60);
          doc.text('SQL Query:', 20, yPosition);
          yPosition += 7;
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          const queryLines = doc.splitTextToSize(query, 170);
          doc.text(queryLines, 20, yPosition);
          yPosition += queryLines.length * 4 + 8;

          // Add results summary
          doc.setFontSize(12);
          doc.setTextColor(60, 60, 60);
          doc.text(`Results: ${rowCount} rows, ${columns.length} columns`, 20, yPosition);
          yPosition += 10;

          // Add table headers
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 40, 40);
          
          const columnWidth = 180 / columns.length;
          const maxColWidth = 30; // Maximum width per column
          const actualColWidth = Math.min(columnWidth, maxColWidth);
          
          columns.forEach((col, index) => {
            const x = 20 + (index * actualColWidth);
            const headerText = col.length > 12 ? col.substring(0, 10) + '...' : col;
            doc.text(headerText, x, yPosition);
          });

          yPosition += 7;

          // Add table data (limited to first 50 rows for PDF)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          
          const maxRows = Math.min(50, values.length);
          
          for (let i = 0; i < maxRows; i++) {
            // Add new page if needed
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
              
              // Add headers on new page
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              columns.forEach((col, index) => {
                const x = 20 + (index * actualColWidth);
                const headerText = col.length > 12 ? col.substring(0, 10) + '...' : col;
                doc.text(headerText, x, yPosition);
              });
              yPosition += 7;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
            }

            values[i].forEach((cell, index) => {
              const x = 20 + (index * actualColWidth);
              let cellText = cell === null ? 'NULL' : String(cell);
              
              // Truncate long text
              if (cellText.length > 20) {
                cellText = cellText.substring(0, 18) + '...';
              }
              
              doc.text(cellText, x, yPosition);
            });
            
            yPosition += 5;
          }

          // Add footer if there are more rows
          if (values.length > 50) {
            yPosition += 8;
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`... and ${values.length - 50} more rows`, 20, yPosition);
          }

          // Add page numbers
          const pageCount = doc.internal.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
          }

          // Generate filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `query_results_${timestamp}.pdf`;
          
          // Save the PDF
          doc.save(filename);
          
          console.log('PDF export completed:', filename);
          
        } catch (error) {
          console.error('Error generating PDF:', error);
          alert(`Failed to generate PDF: ${error.message}`);
        } finally {
          setIsExporting(false);
        }
      };

      const formatCellDisplay = (cell, columnIndex) => {
        if (cell === null) {
          return <span className="text-gray-400 italic">NULL</span>;
        }

        // Try to detect date columns by checking if the value looks like a date
        const cellStr = String(cell);
        if (cellStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) ||
            cellStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) ||
            cellStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return <span className="font-mono text-xs text-blue-600">{cellStr}</span>;
        }

        return cellStr;
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <SafeIcon icon={FiTable} className="w-5 h-5 mr-2" />
                  Query Results
                </h3>
                {originalQuestion && (
                  <p className="text-sm text-gray-600 mt-1">
                    Question: "{originalQuestion}"
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {rowCount} rows • Query: <code className="bg-gray-100 px-1 rounded">{query}</code>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <SafeIcon icon={FiGrid} className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      viewMode === 'json' ? 'bg-white shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <SafeIcon icon={FiCode} className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={exportToCSV}
                    disabled={!columns || !values || values.length === 0 || isExporting}
                    className="px-3 py-1 rounded-md text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm"
                    title="Export as CSV"
                  >
                    {isExporting ? (
                      <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                    ) : (
                      <SafeIcon icon={FiDownload} className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={exportToPDF}
                    disabled={!columns || !values || values.length === 0 || isExporting}
                    className="px-3 py-1 rounded-md text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-white hover:shadow-sm"
                    title="Export as PDF"
                  >
                    {isExporting ? (
                      <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                    ) : (
                      <SafeIcon icon={FiFileText} className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {message ? (
              <div className="text-center py-8 text-gray-500">
                {message}
              </div>
            ) : values.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No results found
              </div>
            ) : viewMode === 'table' ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {columns.map((column, index) => (
                          <th key={index} className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.map((row, rowIndex) => (
                        <motion.tr
                          key={startIndex + rowIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: rowIndex * 0.02 }}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="py-3 px-4 text-gray-600">
                              {formatCellDisplay(cell, cellIndex)}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                    <p className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, values.length)} of {values.length} results
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-600">
                        {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  {JSON.stringify(
                    values.map(row => {
                      const obj = {};
                      columns.forEach((col, index) => {
                        obj[col] = row[index];
                      });
                      return obj;
                    }),
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      );
    };

    export default QueryResults;