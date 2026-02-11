import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getApiUrl } from '@/lib/query-client';
import { useApp } from '@/lib/AppContext';
import Colors from '@/constants/colors';

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

interface Subject {
  id: number;
  key: string;
  name_ar: string;
  color: string;
}

interface ContentBlock {
  type: 'heading' | 'text' | 'formula' | 'example' | 'warning' | 'exercise' | 'image';
  title: string;
  content: string;
}

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { lessonProgress, updateLessonProgress } = useApp();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const progress = lessonProgress[parseInt(id)] || {
    is_studied: false,
    has_notes: false,
    exercise_completed: false
  };

  const toggleProgress = (key: keyof typeof progress) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateLessonProgress(parseInt(id), { [key]: !progress[key] });
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const baseUrl = getApiUrl();
      const lessonId = parseInt(id, 10);

      const lessonResponse = await fetch(new URL(`/api/lesson/${lessonId}`, baseUrl).toString());
      if (!lessonResponse.ok) {
        setErrorMessage('فشل تحميل الدرس');
        return;
      }
      const lessonData: Lesson = await lessonResponse.json();
      setLesson(lessonData);

      if (lessonData.content_blocks_json) {
        try {
          const blocks: ContentBlock[] = JSON.parse(lessonData.content_blocks_json);
          setContentBlocks(Array.isArray(blocks) ? blocks : []);
        } catch {
          setContentBlocks([]);
        }
      } else {
        setContentBlocks([]);
      }

      const subjectsResponse = await fetch(new URL('/api/subjects', baseUrl).toString());
      const subjects: Subject[] = await subjectsResponse.json();
      const foundSubject = subjects.find((s) => s.id === lessonData.subject_id);
      setSubject(foundSubject || null);
    } catch (error) {
      console.error('فشل تحميل الدرس:', error);
      setErrorMessage('فشل تحميل الدرس');
    } finally {
      setIsLoading(false);
    }
  };

  const subjectColor = subject?.color || Colors.primary;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{errorMessage || 'الدرس غير موجود'}</Text>
          <PrimaryButton title="رجوع" onPress={() => router.back()} variant="secondary" />
        </View>
      </View>
    );
  }

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <View key={index} style={styles.headingBlock}>
            <View style={[styles.headingAccent, { backgroundColor: subjectColor }]} />
            <Text style={styles.headingText}>{block.content || block.title}</Text>
          </View>
        );
      case 'text':
        return (
          <View key={index} style={styles.textBlock}>
            {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
            <Text style={styles.textContent}>{block.content}</Text>
          </View>
        );
      case 'formula':
        return (
          <View key={index} style={styles.formulaBlock}>
            {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
            <View style={[styles.formulaBox, { borderColor: subjectColor + '40' }]}>
              <Text style={styles.formulaText}>{block.content}</Text>
            </View>
          </View>
        );
      case 'example':
        return (
          <View key={index} style={[styles.cardBlock, styles.exampleCard]}>
            {block.title ? <Text style={[styles.cardTitle, { color: Colors.success }]}>{block.title}</Text> : null}
            <Text style={styles.cardContent}>{block.content}</Text>
          </View>
        );
      case 'warning':
        return (
          <View key={index} style={[styles.cardBlock, styles.warningCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle" size={18} color={Colors.warning} />
              {block.title ? <Text style={[styles.cardTitle, { color: Colors.warning }]}>{block.title}</Text> : null}
            </View>
            <Text style={styles.cardContent}>{block.content}</Text>
          </View>
        );
      case 'exercise':
        return (
          <View key={index} style={[styles.cardBlock, styles.exerciseCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="pencil" size={18} color="#2980B9" />
              {block.title ? <Text style={[styles.cardTitle, { color: '#2980B9' }]}>{block.title}</Text> : null}
            </View>
            <Text style={styles.cardContent}>{block.content}</Text>
          </View>
        );
      case 'image':
        return (
          <View key={index} style={styles.imageBlock}>
            {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
            <Image 
              source={{ uri: block.content.startsWith('http') ? block.content : `${getApiUrl()}${block.content}` }} 
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        );
      default:
        return (
          <View key={index} style={styles.textBlock}>
            <Text style={styles.textContent}>{block.content}</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset }]}>
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
          {subject && (
            <View style={styles.subjectBadge}>
              <View style={[styles.subjectDot, { backgroundColor: subjectColor }]} />
              <Text style={styles.subjectName}>{subject.name_ar}</Text>
            </View>
          )}
          <Text style={styles.lessonTitle}>{lesson.title_ar}</Text>
          <View style={styles.statusBadge}>
            {lesson.status === 'published' ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={[styles.statusText, { color: Colors.success }]}>منشور</Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={16} color={Colors.warning} />
                <Text style={[styles.statusText, { color: Colors.warning }]}>مسودة</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {lesson.summary_ar ? (
          <View style={[styles.summaryContainer, { borderRightColor: subjectColor }]}>
            <Text style={styles.summaryLabel}>ملخص الدرس</Text>
            <Text style={styles.summaryText}>{lesson.summary_ar}</Text>
          </View>
        ) : null}

        {contentBlocks.length > 0 ? (
          contentBlocks.map((block, index) => renderBlock(block, index))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>لا يوجد محتوى لهذا الدرس بعد.</Text>
          </View>
        )}

        <View style={styles.completionSection}>
          <Text style={styles.sectionTitle}>إكمال الدرس</Text>
          <View style={styles.completionGrid}>
            <Pressable 
              style={[styles.completionItem, progress.is_studied && styles.completionItemDone]}
              onPress={() => toggleProgress('is_studied')}
            >
              <Ionicons name={progress.is_studied ? "checkmark-circle" : "ellipse-outline"} size={24} color={progress.is_studied ? Colors.success : Colors.textSecondary} />
              <Text style={[styles.completionText, progress.is_studied && styles.completionTextDone]}>تمت الدراسة</Text>
            </Pressable>

            <Pressable 
              style={[styles.completionItem, progress.has_notes && styles.completionItemDone]}
              onPress={() => toggleProgress('has_notes')}
            >
              <Ionicons name={progress.has_notes ? "checkmark-circle" : "ellipse-outline"} size={24} color={progress.has_notes ? Colors.success : Colors.textSecondary} />
              <Text style={[styles.completionText, progress.has_notes && styles.completionTextDone]}>تدوين الملاحظات</Text>
            </Pressable>

            <Pressable 
              style={[styles.completionItem, progress.exercise_completed && styles.completionItemDone]}
              onPress={() => toggleProgress('exercise_completed')}
            >
              <Ionicons name={progress.exercise_completed ? "checkmark-circle" : "ellipse-outline"} size={24} color={progress.exercise_completed ? Colors.success : Colors.textSecondary} />
              <Text style={[styles.completionText, progress.exercise_completed && styles.completionTextDone]}>حل التمارين</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 100 }} />
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
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  headerContent: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  subjectBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 6,
  },
  subjectName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lessonTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  summaryContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderRightWidth: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
    textAlign: 'right',
  },
  headingBlock: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  headingAccent: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginLeft: 10,
  },
  headingText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
  },
  textBlock: {
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 6,
  },
  textContent: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 28,
    textAlign: 'right',
  },
  formulaBlock: {
    marginBottom: 12,
  },
  formulaBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  formulaText: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  cardBlock: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exampleCard: {
    backgroundColor: Colors.success + '10',
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  warningCard: {
    backgroundColor: Colors.warning + '10',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  exerciseCard: {
    backgroundColor: '#2980B9' + '10',
    borderLeftWidth: 4,
    borderLeftColor: '#2980B9',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'right',
    marginBottom: 6,
  },
  cardContent: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 26,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  imageBlock: {
    marginBottom: 16,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  completionSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 16,
  },
  completionGrid: {
    gap: 12,
  },
  completionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  completionItemDone: {
    borderColor: Colors.success + '40',
    backgroundColor: Colors.success + '05',
  },
  completionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  completionTextDone: {
    color: Colors.success,
    textDecorationLine: 'line-through',
  },
});
