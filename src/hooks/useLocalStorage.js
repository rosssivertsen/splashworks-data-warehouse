import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing localStorage operations with type safety and error handling
 * Provides a React-friendly interface for persistent storage
 */
const useLocalStorage = (key, initialValue, options = {}) => {
  const {
    serializer = JSON,
    deserializer = JSON,
    errorHandler = console.error
  } = options;

  // Get stored value or return initial value
  const getStoredValue = useCallback(() => {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) {
        return initialValue;
      }
      
      // Handle different types of stored values
      if (typeof initialValue === 'string') {
        return storedValue;
      }
      
      return deserializer.parse(storedValue);
    } catch (error) {
      errorHandler(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, deserializer, errorHandler]);

  const [storedValue, setStoredValue] = useState(getStoredValue);

  // Update localStorage when value changes
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Update state
      setStoredValue(valueToStore);
      
      // Store in localStorage
      let serializedValue = null;
      if (valueToStore === null || valueToStore === undefined) {
        localStorage.removeItem(key);
      } else {
        serializedValue = typeof valueToStore === 'string' 
          ? valueToStore 
          : serializer.stringify(valueToStore);
        localStorage.setItem(key, serializedValue);
      }
      
      // Dispatch storage event for cross-tab synchronization
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: serializedValue,
        oldValue: localStorage.getItem(key)
      }));
      
    } catch (error) {
      errorHandler(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue, serializer, errorHandler]);

  // Remove item from localStorage
  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
      
      // Dispatch storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: null,
        oldValue: localStorage.getItem(key)
      }));
    } catch (error) {
      errorHandler(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue, errorHandler]);

  // Check if value exists in localStorage
  const hasValue = useCallback(() => {
    return localStorage.getItem(key) !== null;
  }, [key]);

  // Listen for storage events (cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== e.oldValue) {
        try {
          const newValue = e.newValue 
            ? (typeof initialValue === 'string' 
                ? e.newValue 
                : deserializer.parse(e.newValue))
            : initialValue;
          setStoredValue(newValue);
        } catch (error) {
          errorHandler(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, deserializer, errorHandler]);

  return [storedValue, setValue, removeValue, hasValue];
};

/**
 * Specialized hook for managing API key storage
 */
export const useApiKey = () => {
  const [apiKey, setApiKey, removeApiKey, hasApiKey] = useLocalStorage('openai_api_key', '', {
    errorHandler: (message, error) => {
      console.warn('API Key storage error:', message, error);
    }
  });

  // Validate API key format
  const isValidApiKey = useCallback((key) => {
    return typeof key === 'string' && key.startsWith('sk-') && key.length > 20;
  }, []);

  // Set API key with validation
  const setValidatedApiKey = useCallback((key) => {
    if (!key || key.trim() === '') {
      setApiKey('');
      return true;
    }

    if (isValidApiKey(key)) {
      setApiKey(key);
      return true;
    }

    console.warn('Invalid API key format provided');
    return false;
  }, [setApiKey, isValidApiKey]);

  return {
    apiKey,
    setApiKey: setValidatedApiKey,
    removeApiKey,
    hasApiKey,
    isValidApiKey: isValidApiKey(apiKey)
  };
};

/**
 * Specialized hook for managing user preferences
 */
export const useUserPreferences = () => {
  const defaultPreferences = {
    theme: 'light',
    itemsPerPage: 50,
    dateFormat: 'ISO',
    autoSave: true,
    showHelpTips: true
  };

  const [preferences, setPreferences, removePreferences] = useLocalStorage(
    'user_preferences', 
    defaultPreferences
  );

  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, [setPreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
  }, [setPreferences]);

  return {
    preferences,
    updatePreference,
    resetPreferences,
    removePreferences
  };
};

export default useLocalStorage;