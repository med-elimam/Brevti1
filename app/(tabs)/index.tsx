import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/lib/AppContext';
import { CountdownCard } from '@/components/CountdownCard';
import { QuickActionButton } from '@/components/QuickActionButton';
import { ProgressRing } from '@/components/ProgressRing';
import Colors from '@/constants/colors';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    settings,
    subjects,
    todayMinutes,
    daysUntilExam,
    refreshData,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const dailyGoal = settings?.daily_minutes_goal || 60;
  const dailyProgress = Math.min(100, (todayMinutes / dailyGoal) * 100);

  const totalQuestions = subjects.reduce((sum, s) => sum + (s.question_count || 0), 0);
  const totalLessons = subjects.reduce((sum, s) => sum + (s.lesson_count || 0), 0);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopInset + 16, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>مرحباً بك</Text>
          <Pressable
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>

        {settings?.exam_date && (
          <CountdownCard daysLeft={daysUntilExam} examDate={settings.exam_date} />
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ProgressRing
              progress={dailyProgress}
              size={70}
              strokeWidth={7}
              color={Colors.accent}
            />
            <Text style={styles.statLabel}>هدف اليوم</Text>
            <Text style={styles.statValue}>{todayMinutes}/{dailyGoal} د</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statCircle}>
              <Ionicons name="book" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.statLabel}>الدروس</Text>
            <Text style={styles.statValue}>{totalLessons} درس</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.statCircle}>
              <Ionicons name="help-circle" size={28} color={Colors.secondary} />
            </View>
            <Text style={styles.statLabel}>الأسئلة</Text>
            <Text style={styles.statValue}>{totalQuestions} سؤال</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.quickActions}>
            <QuickActionButton
              icon="timer-outline"
              label="جلسة تركيز"
              color={Colors.primary}
              onPress={() => router.push('/timer')}
            />
            <QuickActionButton
              icon="help-circle-outline"
              label="تمارين"
              color={Colors.secondary}
              onPress={() => router.push('/(tabs)/exercises')}
            />
            <QuickActionButton
              icon="document-text-outline"
              label="امتحان تجريبي"
              color={Colors.accent}
              onPress={() => router.push('/mock')}
            />
            <QuickActionButton
              icon="calendar-outline"
              label="الخطة الأسبوعية"
              color={Colors.subjects.math}
              onPress={() => router.push('/(tabs)/plan')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المواد الدراسية</Text>
          <View style={styles.subjectsProgress}>
            {subjects.map((subject) => (
              <Pressable
                key={subject.id}
                style={styles.subjectProgressItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/subjects/${subject.id}`);
                }}
              >
                <View style={styles.subjectProgressHeader}>
                  <View
                    style={[
                      styles.subjectDot,
                      { backgroundColor: subject.color },
                    ]}
                  />
                  <Text style={styles.subjectProgressName}>{subject.name_ar}</Text>
                  <Text style={[styles.subjectProgressCount, { color: subject.color }]}>
                    {subject.lesson_count} درس | {subject.question_count} سؤال
                  </Text>
                </View>
                <View style={styles.subjectProgressBar}>
                  <View
                    style={[
                      styles.subjectProgressFill,
                      {
                        width: subject.lesson_count > 0 ? '100%' : '0%',
                        backgroundColor: subject.color,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))}
            {subjects.length === 0 && (
              <View style={styles.emptyRecommendations}>
                <Ionicons name="book-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>لا توجد مواد بعد</Text>
              </View>
            )}
          </View>
        </View>
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
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginBottom: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'right',
  },
  quickActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyRecommendations: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  subjectsProgress: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  subjectProgressItem: {
    marginBottom: 16,
  },
  subjectProgressHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  subjectProgressName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'right',
  },
  subjectProgressCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  subjectProgressBar: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  subjectProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
