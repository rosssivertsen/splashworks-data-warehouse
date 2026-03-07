import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLocalStorage from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));
    
    expect(result.current[0]).toBe('default-value');
  });

  it('should store and retrieve string values', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', ''));
    
    act(() => {
      result.current[1]('new-value');
    });
    
    expect(result.current[0]).toBe('new-value');
    // Verify value was stored in localStorage
    expect(localStorage.getItem('test-key')).toBeTruthy();
  });

  it('should store and retrieve object values', () => {
    const defaultValue = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('test-key', defaultValue));
    
    const newValue = { name: 'updated', count: 5 };
    act(() => {
      result.current[1](newValue);
    });
    
    expect(result.current[0]).toEqual(newValue);
  });

  it('should store and retrieve array values', () => {
    const defaultValue: string[] = [];
    const { result } = renderHook(() => useLocalStorage('test-key', defaultValue));
    
    const newValue = ['item1', 'item2', 'item3'];
    act(() => {
      result.current[1](newValue);
    });
    
    expect(result.current[0]).toEqual(newValue);
    expect(result.current[0].length).toBe(3);
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', null as string | null));
    
    expect(result.current[0]).toBe(null);
    
    act(() => {
      result.current[1]('value');
    });
    
    expect(result.current[0]).toBe('value');
    
    act(() => {
      result.current[1](null);
    });
    
    expect(result.current[0]).toBe(null);
  });

  it('should persist value across hook re-renders', () => {
    const { result, rerender } = renderHook(() => useLocalStorage('test-key', 'initial'));
    
    act(() => {
      result.current[1]('updated');
    });
    
    rerender();
    
    expect(result.current[0]).toBe('updated');
  });

  it('should load persisted value from localStorage on initialization', () => {
    // Pre-populate localStorage as the hook would
    const { result: setupResult } = renderHook(() => useLocalStorage('test-key', 'default'));
    act(() => {
      setupResult.current[1]('persisted-value');
    });
    
    // Create a new instance of the hook which should load the persisted value
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    
    // Hook should load and return the persisted value
    expect(result.current[0]).toBe('persisted-value');
  });

  it('should keep multiple hook instances in sync for the same key', () => {
    const firstHook = renderHook(() => useLocalStorage('shared-key', 'initial'));
    const secondHook = renderHook(() => useLocalStorage('shared-key', 'initial'));

    act(() => {
      firstHook.result.current[1]('updated');
    });

    expect(firstHook.result.current[0]).toBe('updated');
    expect(secondHook.result.current[0]).toBe('updated');
  });

  it('should apply sequential functional updates against the latest value', () => {
    const { result } = renderHook(() => useLocalStorage('counter-key', 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
  });

  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage.setItem to throw an error
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('Storage full');
    };
    
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    
    // Should still work with the in-memory value
    act(() => {
      result.current[1]('new-value');
    });
    
    expect(result.current[0]).toBe('new-value');
    
    // Restore original setItem
    localStorage.setItem = originalSetItem;
  });

  it('should handle different data types correctly', () => {
    // Test with boolean
    const { result: boolResult } = renderHook(() => useLocalStorage('bool-key', false));
    act(() => {
      boolResult.current[1](true);
    });
    expect(boolResult.current[0]).toBe(true);

    // Test with number
    const { result: numResult } = renderHook(() => useLocalStorage('num-key', 0));
    act(() => {
      numResult.current[1](42);
    });
    expect(numResult.current[0]).toBe(42);
  });
});
