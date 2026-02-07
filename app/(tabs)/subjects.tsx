import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubjectCard } from '@/components/SubjectCard';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface ServerSubject {
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

export default function SubjectsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [subjects, setSubjects] = useState<ServerSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
    }, [])
  );

  const loadSubjects = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getApiUrl();
      const response = await fetch(new URL('/api/subjects', baseUrl).toString());
      const data: ServerSubject[] = await response.json();
      setSubjects(data);
    } catch (error) {
      console.error('Failed to load subjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopInset + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>المواد الدراسية</Text>
        <Text style={styles.subtitle}>اختر مادة لعرض الدروس</Text>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              name={subject.name_ar}
              color={subject.color || Colors.primary}
              progress={0}
              totalLessons={subject.lesson_count}
              completedLessons={0}
              onPress={() => router.push(`/subjects/${subject.id}`)}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 24,
  },
  loader: {
    marginTop: 40,
  },
});
