import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDashboard from './useDashboard';

describe('useDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves explicit false dashboard settings during creation', () => {
    const { result } = renderHook(() => useDashboard());

    let createdDashboard;
    act(() => {
      createdDashboard = result.current.createDashboard('Operations', {
        showGrid: false,
        autoRefresh: false,
        refreshInterval: 0
      });
    });

    expect(createdDashboard.settings.showGrid).toBe(false);
    expect(createdDashboard.settings.autoRefresh).toBe(false);
    expect(createdDashboard.settings.refreshInterval).toBe(0);
    expect(result.current.selectedDashboard?.id).toBe(createdDashboard.id);
  });
});
