import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { UiControl } from '../types';
import { useToast } from './ToastContext';

interface UiControlsContextType {
  controls: UiControl[];
  controlsMap: Record<string, boolean>;
  loading: boolean;
  isRoleEnforcementEnabled: boolean;
  isElementVisible: (elementId: string) => boolean;
  isPageEnabled: (pageKey: string) => boolean;
  isButtonEnabled: (buttonKey: string) => boolean;
  isIconEnabled: (iconKey: string) => boolean;
  toggleControl: (elementId: string, newState: boolean, meta?: { name?: string; element_type?: string; description?: string; target_location?: string }) => Promise<void>;
  resetAllControls: () => Promise<void>;
  bulkSetControls: (newState: boolean) => Promise<void>;
  refreshControls: () => Promise<void>;
}

const UiControlsContext = createContext<UiControlsContextType | null>(null);

export const UiControlsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [controls, setControls] = useState<UiControl[]>([]);
  const [controlsMap, setControlsMap] = useState<Record<string, boolean>>({
    // Safe defaults until loaded
    page_dashboard: true,
    page_board: true,
    page_backlog: true,
    page_list_view: true,
    page_timeline: true,
    page_calendar: true,
    page_reports: true,
    page_sprints: true,
    page_projects: true,
    page_teams: true,
    page_my_work: true,
    page_settings: true,
    btn_nav_projects_dropdown: true,
    btn_nav_your_work: true,
    btn_nav_dashboards: true,
    btn_nav_teams: true,
    btn_create_project: true,
    btn_create_ticket: true,
    btn_edit_project: true,
    btn_delete_project: true,
    btn_override_task: true,
    btn_filter_controls: true,
    btn_export_reports: true,
    btn_theme_toggle: true,
    btn_role_enforcement: true,
    icon_hold_badge: true,
    icon_blocked_badge: true,
    icon_assignee_avatar: true,
    icon_priority_badges: true,
    icon_due_date: true,
  });
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const refreshControls = useCallback(async () => {
    try {
      const res = await api.getUiControls();
      if (res.map) {
        setControlsMap(res.map);
      }
      if (res.controls) {
        setControls(res.controls);
      }
    } catch (e) {
      // Fallback to defaults
    }
  }, []);

  useEffect(() => {
    refreshControls();
  }, [refreshControls]);

  const isElementVisible = useCallback((elementId: string): boolean => {
    // If not found in map, default to true
    if (controlsMap[elementId] === undefined) return true;
    return !!controlsMap[elementId];
  }, [controlsMap]);

  const isPageEnabled = useCallback((pageKey: string): boolean => {
    const key = pageKey.startsWith('page_') ? pageKey : `page_${pageKey}`;
    return isElementVisible(key);
  }, [isElementVisible]);

  const isButtonEnabled = useCallback((buttonKey: string): boolean => {
    const key = buttonKey.startsWith('btn_') ? buttonKey : `btn_${buttonKey}`;
    return isElementVisible(key);
  }, [isElementVisible]);

  const isIconEnabled = useCallback((iconKey: string): boolean => {
    const key = iconKey.startsWith('icon_') ? iconKey : `icon_${iconKey}`;
    return isElementVisible(key);
  }, [isElementVisible]);

  const toggleControl = async (
    elementId: string,
    newState: boolean,
    meta?: { name?: string; element_type?: string; description?: string; target_location?: string }
  ) => {
    // Optimistic update
    setControlsMap(prev => ({ ...prev, [elementId]: newState }));
    setControls(prev => {
      const exists = prev.some(c => c.element_id === elementId);
      if (exists) {
        return prev.map(c => c.element_id === elementId ? { ...c, is_enabled: newState ? 1 : 0 } : c);
      } else {
        return [
          ...prev,
          {
            id: Date.now(),
            element_id: elementId,
            element_type: meta?.element_type || 'button',
            name: meta?.name || elementId,
            description: meta?.description || `Control for ${meta?.name || elementId}`,
            target_location: meta?.target_location || 'Live Workspace App',
            is_enabled: newState ? 1 : 0,
            updated_at: new Date().toISOString(),
          } as any
        ];
      }
    });

    try {
      const res = await api.updateUiControl(elementId, newState, meta);
      if (res.map) {
        setControlsMap(res.map);
      }
      success('⚡ Autosaved Instantly', res.message || `${elementId} saved & synced to all users`);
    } catch (err: any) {
      // Rollback on failure
      setControlsMap(prev => ({ ...prev, [elementId]: !newState }));
      error('Failed to update UI control', err.message);
      throw err;
    }
  };

  const resetAllControls = async () => {
    try {
      const res = await api.resetAllUiControls();
      if (res.map) {
        setControlsMap(res.map);
      }
      await refreshControls();
      success('⚡ Autosaved Instantly', 'All pages, buttons and icons restored to enabled');
    } catch (err: any) {
      error('Reset Failed', err.message);
    }
  };

  const bulkSetControls = async (newState: boolean) => {
    try {
      const res = await api.bulkSetUiControls(newState);
      if (res.map) {
        setControlsMap(res.map);
      }
      await refreshControls();
      success('⚡ Batch Autosaved Instantly', res.message || 'Batch update applied & synced');
    } catch (err: any) {
      error('Bulk Update Failed', err.message);
    }
  };

  const isRoleEnforcementEnabled = controlsMap['btn_role_enforcement'] !== false;

  return (
    <UiControlsContext.Provider
      value={{
        controls,
        controlsMap,
        loading,
        isRoleEnforcementEnabled,
        isElementVisible,
        isPageEnabled,
        isButtonEnabled,
        isIconEnabled,
        toggleControl,
        resetAllControls,
        bulkSetControls,
        refreshControls,
      }}
    >
      {children}
    </UiControlsContext.Provider>
  );
};

export const useUiControls = () => {
  const ctx = useContext(UiControlsContext);
  if (!ctx) {
    throw new Error('useUiControls must be used within a UiControlsProvider');
  }
  return ctx;
};

