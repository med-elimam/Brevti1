import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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

export interface LessonProgress {
  lesson_id: number;
  is_studied: boolean;
  has_notes: boolean;
  exercise_completed: boolean;
  completed_at: string | null;
}

interface AppContextValue {
  isLoading: boolean;
  isInitialized: boolean;
  settings: Settings | null;
  subjects: ServerSubject[];
  lessonProgress: Record<number, LessonProgress>;
  todayMinutes: number;
  daysUntilExam: number;
  updateAppSettings: (newSettings: Partial<Settings>) => Promise<void>;
  updateLessonProgress: (lessonId: number, progress: Partial<LessonProgress>) => Promise<void>;
  refreshData: () => Promise<void>;
  resetAppData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [subjects, setSubjects] = useState<ServerSubject[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<number, LessonProgress>>({});
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

      const progressRes = await globalThis.fetch(new URL('/api/lesson-progress', baseUrl).toString());
      if (progressRes.ok) {
        const progressData: LessonProgress[] = await progressRes.json();
        const progressMap = progressData.reduce((acc, curr) => ({
          ...acc,
          [curr.lesson_id]: curr
        }), {});
        setLessonProgress(progressMap);
      }
    } catch (error) {
      console.error('Error loading subjects/progress from server:', error);
    }
  };

  const initializeApp = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getApiUrl();
      
      // Load settings via API
      const settingsRes = await globalThis.fetch(new URL('/api/settings', baseUrl).toString());
      if (settingsRes.ok) {
        const appSettings: Settings = await settingsRes.json();
        setSettings(appSettings);
        setIsInitialized(appSettings?.onboarding_complete === 1);
      }

      await loadSubjectsFromServer();
      
      // Load today's minutes via API
      const minutesRes = await globalThis.fetch(new URL('/api/study-minutes/today', baseUrl).toString());
      if (minutesRes.ok) {
        const { minutes } = await minutesRes.json();
        setTodayMinutes(minutes);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const baseUrl = getApiUrl();
      const settingsRes = await globalThis.fetch(new URL('/api/settings', baseUrl).toString());
      if (settingsRes.ok) {
        const appSettings: Settings = await settingsRes.json();
        setSettings(appSettings);
        setIsInitialized(appSettings?.onboarding_complete === 1);
      }

      await loadSubjectsFromServer();
      
      const minutesRes = await globalThis.fetch(new URL('/api/study-minutes/today', baseUrl).toString());
      if (minutesRes.ok) {
        const { minutes } = await minutesRes.json();
        setTodayMinutes(minutes);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const updateAppSettings = async (newSettings: Partial<Settings>) => {
    try {
      const baseUrl = getApiUrl();
      const response = await globalThis.fetch(new URL('/api/settings', baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      
      if (response.ok) {
        const updated: Settings = await response.json();
        setSettings(updated);
        if (newSettings.onboarding_complete !== undefined) {
          setIsInitialized(updated?.onboarding_complete === 1);
        }
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const updateLessonProgress = async (lessonId: number, progress: Partial<LessonProgress>) => {
    try {
      const baseUrl = getApiUrl();
      const current = lessonProgress[lessonId] || {
        lesson_id: lessonId,
        is_studied: false,
        has_notes: false,
        exercise_completed: false,
        completed_at: null
      };
      
      const updated = { ...current, ...progress };
      
      const response = await globalThis.fetch(new URL(`/api/lesson-progress/${lessonId}`, baseUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (response.ok) {
        setLessonProgress(prev => ({
          ...prev,
          [lessonId]: updated
        }));
      }
    } catch (error) {
      console.error('Error updating lesson progress:', error);
    }
  };

  const resetAppData = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getApiUrl();
      await globalThis.fetch(new URL('/api/reset', baseUrl).toString(), { method: 'POST' });
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
      lessonProgress,
      todayMinutes,
      daysUntilExam,
      updateAppSettings,
      updateLessonProgress,
      refreshData,
      resetAppData,
    }),
    [
      isLoading,
      isInitialized,
      settings,
      subjects,
      lessonProgress,
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
