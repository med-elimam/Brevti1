import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LessonCard } from '@/components/LessonCard';
import { ProgressRing } from '@/components/ProgressRing';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface Subject {
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

interface Lesson {
  id: number;
  subject_id: number;
  title_ar: string;
  order_index: number;
  status: string;
  content_blocks_json: string;
  summary_ar: string;
  updated_at: string;
}

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getApiUrl();

      const subjectsResponse = await fetch(new URL('/api/subjects', baseUrl).toString());
      const subjects: Subject[] = await subjectsResponse.json();

      const subjectId = parseInt(id, 10);
      const foundSubject = subjects.find((s) => s.id === subjectId);
      setSubject(foundSubject || null);

      if (foundSubject) {
        const lessonsUrl = new URL(`/api/lessons?subject_id=${foundSubject.id}`, baseUrl);
        const lessonsResponse = await fetch(lessonsUrl.toString());
        const lessonsData: Lesson[] = await lessonsResponse.json();
        setLessons(lessonsData);
      }
    } catch (error) {
      console.error('فشل تحميل البيانات:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completedLessons = lessons.filter((l) => l.status === 'published').length;
  const progress = lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;

  if (!subject) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  const subjectColor = subject.color || Colors.primary;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-forward" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <View
            style={[styles.subjectIcon, { backgroundColor: subjectColor + '20' }]}
          >
            <Ionicons name="book" size={32} color={subjectColor} />
          </View>
          <Text style={styles.subjectName}>{subject.name_ar}</Text>
          <View style={styles.statsRow}>
            <ProgressRing
              progress={progress}
              size={60}
              strokeWidth={6}
              color={subjectColor}
            />
            <View style={styles.statsInfo}>
              <Text style={styles.statsText}>
                {completedLessons} من {lessons.length} دروس مكتملة
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>الدروس</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : (
          lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              title={`${lesson.order_index}. ${lesson.title_ar}`}
              isCompleted={lesson.status === 'published'}
              onPress={() => router.push(`/lessons/${lesson.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 32,
  },
  subjectIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  statsInfo: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 16,
  },
});
