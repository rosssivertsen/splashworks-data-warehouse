import { useState, useCallback } from 'react';

/**
 * Custom hook for managing chart data processing and transformations
 * Centralizes data preparation, formatting, and visualization logic
 */
const useChartData = () => {
  const [chartData, setChartData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);

  // Chart type configurations
  const chartTypes = [
    { value: 'bar', label: 'Bar Chart', icon: 'FiBarChart2' },
    { value: 'line', label: 'Line Chart', icon: 'FiTrendingUp' },
    { value: 'pie', label: 'Pie Chart', icon: 'FiPieChart' },
    { value: 'area', label: 'Area Chart', icon: 'FiTrendingUp' }
  ];

  // Process query results into chart-ready format
  const processQueryData = useCallback((queryResults, chartConfig) => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      if (!queryResults || !queryResults.values || queryResults.values.length === 0) {
        throw new Error('No data available for chart generation');
      }

      const { columns, values } = queryResults;
      const { type, xAxis, yAxis, groupBy } = chartConfig;

      let processedData;
      
      switch (type) {
        case 'bar':
        case 'line':
          processedData = processLinearChart(columns, values, xAxis, yAxis, groupBy);
          break;
        case 'pie':
          processedData = processPieChart(columns, values, xAxis, yAxis);
          break;
        case 'area':
          processedData = processAreaChart(columns, values, xAxis, yAxis, groupBy);
          break;
        default:
          throw new Error(`Unsupported chart type: ${type}`);
      }

      setChartData(processedData);
      return processedData;

    } catch (error) {
      setProcessingError(error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Process data for bar/line charts
  const processLinearChart = useCallback((columns, values, xAxisCol, yAxisCol, groupByCol) => {
    const xIndex = columns.indexOf(xAxisCol);
    const yIndex = columns.indexOf(yAxisCol);
    const groupIndex = groupByCol ? columns.indexOf(groupByCol) : -1;

    if (xIndex === -1 || yIndex === -1) {
      throw new Error('Invalid column selection for chart axes');
    }

    if (groupIndex !== -1) {
      // Grouped data
      const grouped = {};
      values.forEach(row => {
        const group = row[groupIndex];
        const x = row[xIndex];
        const y = parseFloat(row[yIndex]) || 0;

        if (!grouped[group]) {
          grouped[group] = [];
        }
        grouped[group].push([x, y]);
      });

      return {
        type: 'grouped',
        series: Object.entries(grouped).map(([name, data]) => ({
          name,
          data: data.sort((a, b) => a[0] - b[0])
        })),
        xAxis: { name: xAxisCol, type: 'category' },
        yAxis: { name: yAxisCol, type: 'value' }
      };
    } else {
      // Simple data
      const data = values
        .map(row => [row[xIndex], parseFloat(row[yIndex]) || 0])
        .sort((a, b) => a[0] - b[0]);

      return {
        type: 'simple',
        series: [{
          name: yAxisCol,
          data
        }],
        xAxis: { name: xAxisCol, type: 'category' },
        yAxis: { name: yAxisCol, type: 'value' }
      };
    }
  }, []);

  // Process data for pie charts
  const processPieChart = useCallback((columns, values, labelCol, valueCol) => {
    const labelIndex = columns.indexOf(labelCol);
    const valueIndex = columns.indexOf(valueCol);

    if (labelIndex === -1 || valueIndex === -1) {
      throw new Error('Invalid column selection for pie chart');
    }

    const data = values.map(row => ({
      name: row[labelIndex],
      value: parseFloat(row[valueIndex]) || 0
    }));

    return {
      type: 'pie',
      series: [{
        name: valueCol,
        data
      }],
      total: data.reduce((sum, item) => sum + item.value, 0)
    };
  }, []);

  // Process data for area charts
  const processAreaChart = useCallback((columns, values, xAxisCol, yAxisCol, groupByCol) => {
    // Area charts use similar processing to line charts but with area styling
    const linearData = processLinearChart(columns, values, xAxisCol, yAxisCol, groupByCol);
    
    return {
      ...linearData,
      type: 'area',
      series: linearData.series.map(series => ({
        ...series,
        areaStyle: {}
      }))
    };
  }, [processLinearChart]);

  // Generate ECharts configuration from processed data
  const generateEChartsConfig = useCallback((processedData, customOptions = {}) => {
    if (!processedData) {
      throw new Error('No processed data available for chart configuration');
    }

    const baseConfig = {
      tooltip: {
        trigger: processedData.type === 'pie' ? 'item' : 'axis',
        formatter: processedData.type === 'pie' 
          ? '{a} <br/>{b}: {c} ({d}%)'
          : null
      },
      legend: {
        data: processedData.series.map(s => s.name),
        top: 10
      },
      grid: processedData.type !== 'pie' ? {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      } : undefined
    };

    if (processedData.type === 'pie') {
      baseConfig.series = [{
        name: processedData.series[0].name,
        type: 'pie',
        radius: '60%',
        center: ['50%', '60%'],
        data: processedData.series[0].data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }];
    } else {
      baseConfig.xAxis = {
        type: 'category',
        name: processedData.xAxis.name,
        nameLocation: 'middle',
        nameGap: 30,
        data: processedData.series[0].data.map(item => item[0])
      };
      
      baseConfig.yAxis = {
        type: 'value',
        name: processedData.yAxis.name,
        nameLocation: 'middle',
        nameGap: 40
      };

      baseConfig.series = processedData.series.map(series => ({
        name: series.name,
        type: processedData.type === 'area' ? 'line' : processedData.type.replace('area', 'line'),
        data: series.data.map(item => item[1]),
        areaStyle: processedData.type === 'area' ? {} : undefined,
        smooth: processedData.type === 'line' || processedData.type === 'area'
      }));
    }

    return { ...baseConfig, ...customOptions };
  }, []);

  // Auto-suggest chart configuration based on data types
  const suggestChartConfig = useCallback((queryResults) => {
    if (!queryResults || !queryResults.columns) {
      return null;
    }

    const { columns, values } = queryResults;
    if (values.length === 0) {
      return null;
    }

    // Analyze data types
    const columnTypes = columns.map((col, index) => {
      const sample = values.slice(0, 10).map(row => row[index]).filter(val => val !== null);
      
      if (sample.every(val => !isNaN(Date.parse(val)))) {
        return { name: col, type: 'date', index };
      } else if (sample.every(val => !isNaN(parseFloat(val)))) {
        return { name: col, type: 'number', index };
      } else {
        return { name: col, type: 'string', index };
      }
    });

    const dateColumns = columnTypes.filter(col => col.type === 'date');
    const numberColumns = columnTypes.filter(col => col.type === 'number');
    const stringColumns = columnTypes.filter(col => col.type === 'string');

    // Suggest configuration based on available column types
    if (dateColumns.length > 0 && numberColumns.length > 0) {
      return {
        type: 'line',
        xAxis: dateColumns[0].name,
        yAxis: numberColumns[0].name,
        groupBy: stringColumns.length > 0 ? stringColumns[0].name : null
      };
    } else if (stringColumns.length > 0 && numberColumns.length > 0) {
      if (stringColumns[0].name && values.length <= 20) {
        return {
          type: 'pie',
          xAxis: stringColumns[0].name,
          yAxis: numberColumns[0].name
        };
      } else {
        return {
          type: 'bar',
          xAxis: stringColumns[0].name,
          yAxis: numberColumns[0].name
        };
      }
    } else if (numberColumns.length >= 2) {
      return {
        type: 'bar',
        xAxis: columns[0],
        yAxis: numberColumns[0].name
      };
    }

    return null;
  }, []);

  // Clear chart data
  const clearChartData = useCallback(() => {
    setChartData(null);
    setProcessingError(null);
  }, []);

  // Validate chart configuration
  const validateConfig = useCallback((config, availableColumns) => {
    const errors = [];

    if (!config.type) {
      errors.push('Chart type is required');
    }

    if (!chartTypes.find(t => t.value === config.type)) {
      errors.push('Invalid chart type');
    }

    if (!config.xAxis || !availableColumns.includes(config.xAxis)) {
      errors.push('Valid X-axis column is required');
    }

    if (!config.yAxis || !availableColumns.includes(config.yAxis)) {
      errors.push('Valid Y-axis column is required');
    }

    if (config.groupBy && !availableColumns.includes(config.groupBy)) {
      errors.push('Invalid group-by column');
    }

    return errors;
  }, []);

  return {
    // State
    chartData,
    isProcessing,
    processingError,
    chartTypes,

    // Actions
    processQueryData,
    generateEChartsConfig,
    suggestChartConfig,
    clearChartData,
    validateConfig,

    // Utilities
    processLinearChart,
    processPieChart,
    processAreaChart
  };
};

export default useChartData;