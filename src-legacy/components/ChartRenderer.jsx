import React from 'react';
    import { motion } from 'framer-motion';
    import ReactECharts from 'echarts-for-react';
    import * as FiIcons from 'react-icons/fi';
    import SafeIcon from '../common/SafeIcon';

    const { FiBarChart2, FiPieChart, FiTrendingUp } = FiIcons;

    const ChartRenderer = ({ chart }) => {
      const getChartOption = () => {
        const { type, data } = chart;
        
        if (!data || !data.columns || !data.values || data.values.length === 0) {
          return {
            title: {
              text: 'No Data Available',
              left: 'center',
              top: 'center',
              textStyle: { color: '#999' }
            }
          };
        }

        const columns = data.columns;
        const values = data.values;

        // Prepare data based on chart type
        let option = {};
        
        switch (type.toLowerCase()) {
          case 'bar':
            option = {
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: {
                type: 'category',
                data: values.map(row => row[0]),
                axisLabel: { rotate: 45 }
              },
              yAxis: { type: 'value' },
              series: [
                {
                  name: columns[1] || 'Value',
                  type: 'bar',
                  data: values.map(row => row[1]),
                  itemStyle: { color: '#3B82F6' }
                }
              ]
            };
            break;
            
          case 'line':
            option = {
              tooltip: { trigger: 'axis' },
              xAxis: {
                type: 'category',
                data: values.map(row => row[0]),
                axisLabel: { rotate: 45 }
              },
              yAxis: { type: 'value' },
              series: [
                {
                  name: columns[1] || 'Value',
                  type: 'line',
                  data: values.map(row => row[1]),
                  itemStyle: { color: '#10B981' },
                  lineStyle: { color: '#10B981' }
                }
              ]
            };
            break;
            
          case 'pie':
            const pieData = values.map(row => ({ name: row[0], value: row[1] }));
            option = {
              tooltip: { trigger: 'item' },
              series: [
                {
                  type: 'pie',
                  radius: '70%',
                  data: pieData,
                  emphasis: {
                    itemStyle: {
                      shadowBlur: 10,
                      shadowOffsetX: 0,
                      shadowColor: 'rgba(0,0,0,0.5)'
                    }
                  }
                }
              ]
            };
            break;
            
          case 'area':
            option = {
              tooltip: { trigger: 'axis' },
              xAxis: {
                type: 'category',
                data: values.map(row => row[0]),
                axisLabel: { rotate: 45 }
              },
              yAxis: { type: 'value' },
              series: [
                {
                  name: columns[1] || 'Value',
                  type: 'line',
                  data: values.map(row => row[1]),
                  areaStyle: { color: 'rgba(59,130,246,0.3)' },
                  itemStyle: { color: '#3B82F6' },
                  lineStyle: { color: '#3B82F6' }
                }
              ]
            };
            break;
            
          default:
            option = {
              title: {
                text: 'Unsupported Chart Type',
                left: 'center',
                top: 'center',
                textStyle: { color: '#999' }
              }
            };
        }

        return option;
      };

      const getChartIcon = () => {
        switch (chart.type?.toLowerCase()) {
          case 'bar': return FiBarChart2;
          case 'line':
          case 'area': return FiTrendingUp;
          case 'pie': return FiPieChart;
          default: return FiBarChart2;
        }
      };

      const formatDataValue = (value) => {
        // Format date values in ISO format
        if (typeof value === 'string') {
          if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            return <span className="font-mono text-xs">{value}</span>;
          }
        }
        return value;
      };

      return (
        <div className="space-y-3">
          {/* Chart Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SafeIcon icon={getChartIcon()} className="w-4 h-4 text-gray-500" />
              <h4 className="font-medium text-gray-900 truncate">{chart.title}</h4>
            </div>
          </div>

          {/* Chart */}
          <div className="h-64">
            <ReactECharts
              option={getChartOption()}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>

          {/* Chart Description */}
          {chart.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {chart.description}
            </p>
          )}

          {/* Chart Query */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              View SQL Query
            </summary>
            <pre className="mt-2 p-2 bg-gray-50 rounded text-gray-600 overflow-x-auto">
              {chart.query}
            </pre>
          </details>
        </div>
      );
    };

    export default ChartRenderer;