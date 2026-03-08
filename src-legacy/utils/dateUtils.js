// Date utility functions for ISO 8601 formatting
    export const formatDateToISO = (date) => {
      if (!date) return null;
      
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    export const formatDateWithDefaults = (dateString, hasTime = false) => {
      if (!dateString) return '1980-01-01 00:00:00';
      
      // If already in ISO format, return as is
      if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return dateString;
      }
      
      // Handle date only (YYYY-MM-DD)
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return hasTime ? `${dateString} 00:00:00` : `${dateString} 00:00:00`;
      }
      
      // Handle various date formats and convert to ISO
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '1980-01-01 00:00:00';
      }
      
      return formatDateToISO(date);
    };
    
    export const generateDateFilterSQL = (column, startDate, endDate, hasTime = false) => {
      const start = formatDateWithDefaults(startDate, hasTime);
      const end = formatDateWithDefaults(endDate, hasTime);
      
      if (start && end) {
        return `${column} BETWEEN '${start}' AND '${end}'`;
      } else if (start) {
        return `${column} >= '${start}'`;
      } else if (end) {
        return `${column} <= '${end}'`;
      }
      return '';
    };
    
    export const getCurrentDateTime = () => {
      return formatDateToISO(new Date());
    };
    
    export const getDefaultDate = () => {
      return '1980-01-01 00:00:00';
    };
    
    export const parseDateTime = (dateTimeString) => {
      if (!dateTimeString) return null;
      
      // Handle ISO format
      if (dateTimeString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return new Date(dateTimeString.replace(' ', 'T'));
      }
      
      // Handle ISO format with T
      if (dateTimeString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return new Date(dateTimeString);
      }
      
      // Handle date only
      if (dateTimeString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(`${dateTimeString}T00:00:00`);
      }
      
      // Try parsing as is
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) ? null : date;
    };