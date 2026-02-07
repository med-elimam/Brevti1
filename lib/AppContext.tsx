import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  initDatabase,
  seedDatabase,
  getSettings,
  updateSettings,
  getTodayStudyMinutes,
  resetDatabase,
} from '@/db/database';
import type { Settings } from '@/db/types';
import { getApiUrl } from '@/lib/query-client';

export interface ServerSubject {
  id: number;
  key: string;
  name_ar: string;
  color: string;
  icon: string;
  order_index: number;
  is_active: boolean;
  lesson_count: number;
  question_count: number;
}

interface AppContextValue {
  isLoading: boolean;
  isInitialized: boolean;
  settings: Settings | null;
  subjects: ServerSubject[];
  todayMinutes: number;
  daysUntilExam: number;
  updateAppSettings: (newSettings: Partial<Settings>) => Promise<void>;
  refreshData: () => Promise<void>;
  resetAppData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [subjects, setSubjects] = useState<ServerSubject[]>([]);
  const [todayMinutes, setTodayMinutes] = useState(0);

  const daysUntilExam = useMemo(() => {
    if (!settings?.exam_date) return 0;
    const examDate = new Date(settings.exam_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [settings?.exam_date]);

  const loadSubjectsFromServer = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await globalThis.fetch(new URL('/api/subjects', baseUrl).toString());
      if (response.ok) {
        const data: ServerSubject[] = await response.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error('Error loading subjects from server:', error);
    }
  };

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      await initDatabase();
      await seedDatabase();
      
      const appSettings = await getSettings();
      setSettings(appSettings);
      setIsInitialized(appSettings?.onboarding_complete === 1);

      await loadSubjectsFromServer();
      
      const minutes = await getTodayStudyMinutes();
      setTodayMinutes(minutes);
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const appSettings = await getSettings();
      setSettings(appSettings);
      setIsInitialized(appSettings?.onboarding_complete === 1);

      await loadSubjectsFromServer();
      
      const minutes = await getTodayStudyMinutes();
      setTodayMinutes(minutes);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const updateAppSettings = async (newSettings: Partial<Settings>) => {
    try {
      await updateSettings(newSettings);
      const updated = await getSettings();
      setSettings(updated);
      if (newSettings.onboarding_complete !== undefined) {
        setIsInitialized(updated?.onboarding_complete === 1);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const resetAppData = async () => {
    try {
      setIsLoading(true);
      await resetDatabase();
      await initializeApp();
    } catch (error) {
      console.error('Error resetting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      isInitialized,
      settings,
      subjects,
      todayMinutes,
      daysUntilExam,
      updateAppSettings,
      refreshData,
      resetAppData,
    }),
    [
      isLoading,
      isInitialized,
      settings,
      subjects,
      todayMinutes,
      daysUntilExam,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
