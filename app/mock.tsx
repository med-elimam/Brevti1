import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseOption } from '@/components/ExerciseOption';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProgressRing } from '@/components/ProgressRing';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface ServerQuestion {
  id: number;
  subject_id: number;
  lesson_id: number | null;
  difficulty: string;
  qtype: string;
  statement_md: string;
  options_json: string;
  correct_answer_json: string;
  solution_md: string;
}

interface ServerExam {
  id: number;
  subject_id: number;
  title_ar: string;
  year: number | null;
  duration_minutes: number;
  questions: ServerQuestion[];
}

const DEFAULT_DURATION = 60 * 60;

export default function MockExamScreen() {
  const params = useLocalSearchParams<{ examId?: string }>();
  const insets = useSafeAreaInsets();
  const [exam, setExam] = useState<ServerExam | null>(null);
  const [questions, setQuestions] = useState<ServerQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useFocusEffect(
    useCallback(() => {
      loadExam();
    }, [params.examId])
  );

  useEffect(() => {
    if (!isLoading && !isComplete && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isLoading, isComplete, timeLeft]);

  const loadExam = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getApiUrl();

      if (params.examId) {
        const response = await globalThis.fetch(new URL(`/api/exam/${params.examId}`, baseUrl).toString());
        if (!response.ok) { setQuestions([]); return; }
        const data: ServerExam = await response.json();
        setExam(data);
        const qs = data.questions || [];
        setQuestions(qs);
        setAnswers(new Array(qs.length).fill(null));
        setTimeLeft((data.duration_minutes || 60) * 60);
      } else {
        const response = await globalThis.fetch(new URL('/api/questions', baseUrl).toString());
        if (!response.ok) { setQuestions([]); return; }
        const allQuestions: ServerQuestion[] = await response.json();
        const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, 30);
        setQuestions(shuffled);
        setAnswers(new Array(shuffled.length).fill(null));
        setTimeLeft(DEFAULT_DURATION);
      }
    } catch (error) {
      console.error('Error loading exam:', error);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  const getOptions = (q: ServerQuestion): string[] => {
    try { return JSON.parse(q.options_json); } catch { return []; }
  };

  const getCorrectIdx = (q: ServerQuestion): number => {
    try { return JSON.parse(q.correct_answer_json); } catch { return 0; }
  };

  const options = currentQuestion ? getOptions(currentQuestion) : [];

  const handleSelectOption = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = [...answers];
    newAnswers[currentIndex] = index;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsComplete(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const correctCount = questions.reduce((count, question, index) => {
    return count + (answers[index] === getCorrectIdx(question) ? 1 : 0);
  }, 0);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحضير الامتحان...</Text>
        </View>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={64} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>لا توجد أسئلة</Text>
          <Text style={styles.emptySubtitle}>لم يتم العثور على أسئلة لهذا الامتحان</Text>
          <PrimaryButton title="العودة" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (isComplete) {
    const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    if (showReview) {
      return (
        <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
          <View style={styles.header}>
            <Pressable style={styles.closeButton} onPress={() => setShowReview(false)}>
              <Ionicons name="arrow-forward" size={24} color={Colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>مراجعة الإجابات</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {questions.map((question, index) => {
              const userAnswer = answers[index];
              const correctAnswer = getCorrectIdx(question);
              const isCorrect = userAnswer === correctAnswer;
              const opts = getOptions(question);

              return (
                <View key={question.id} style={styles.reviewQuestion}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewNumber}>السؤال {index + 1}</Text>
                    <View style={[styles.reviewBadge, isCorrect ? styles.reviewCorrect : styles.reviewWrong]}>
                      <Ionicons name={isCorrect ? 'checkmark' : 'close'} size={16} color="#fff" />
                    </View>
                  </View>
                  <Text style={styles.reviewQuestionText}>{question.statement_md}</Text>
                  <Text style={styles.reviewAnswer}>
                    إجابتك: {userAnswer !== null ? opts[userAnswer] : 'لم تجب'}
                  </Text>
                  {!isCorrect && (
                    <Text style={styles.reviewCorrectAnswer}>
                      الإجابة الصحيحة: {opts[correctAnswer]}
                    </Text>
                  )}
                  {question.solution_md ? (
                    <Text style={styles.reviewSolution}>{question.solution_md}</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <PrimaryButton title="إغلاق" onPress={() => router.back()} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.resultContainer}>
          <View style={styles.resultIcon}>
            {accuracy >= 70 ? (
              <Ionicons name="trophy" size={64} color={Colors.warning} />
            ) : accuracy >= 50 ? (
              <Ionicons name="ribbon" size={64} color={Colors.success} />
            ) : (
              <Ionicons name="school" size={64} color={Colors.primary} />
            )}
          </View>
          <Text style={styles.resultTitle}>انتهى الامتحان!</Text>
          <Text style={styles.resultSubtitle}>
            نتيجتك: {correctCount} من {questions.length}
          </Text>

          <View style={styles.resultStats}>
            <ProgressRing
              progress={accuracy}
              size={120}
              strokeWidth={12}
              color={accuracy >= 70 ? Colors.success : accuracy >= 50 ? Colors.warning : Colors.danger}
            />
          </View>

          <Text style={styles.resultMessage}>
            {accuracy >= 70
              ? 'أداء ممتاز! أنت مستعد للامتحان.'
              : accuracy >= 50
              ? 'أداء جيد، تحتاج لمزيد من المراجعة.'
              : 'تحتاج للمزيد من الدراسة والتدريب.'}
          </Text>

          <View style={styles.resultButtons}>
            <PrimaryButton title="مراجعة الإجابات" onPress={() => setShowReview(true)} />
            <View style={{ height: 12 }} />
            <PrimaryButton title="العودة" onPress={() => router.back()} variant="secondary" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.closeButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.timerContainer}>
          <Ionicons
            name="time"
            size={20}
            color={timeLeft < 300 ? Colors.danger : Colors.primary}
          />
          <Text
            style={[
              styles.timerText,
              { color: timeLeft < 300 ? Colors.danger : Colors.primary },
            ]}
          >
            {formatTime(timeLeft)}
          </Text>
        </View>
        <Text style={styles.questionCounter}>
          {currentIndex + 1}/{questions.length}
        </Text>
      </View>

      <View style={styles.progressIndicator}>
        {questions.map((_, index) => (
          <Pressable
            key={index}
            style={[
              styles.progressDot,
              index === currentIndex && styles.progressDotActive,
              answers[index] !== null && styles.progressDotAnswered,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentIndex(index);
            }}
          />
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.statement_md}</Text>
        </View>

        <View style={styles.options}>
          {options.map((option, index) => (
            <ExerciseOption
              key={index}
              text={option}
              index={index}
              selected={answers[currentIndex] === index}
              correct={null}
              showResult={false}
              onSelect={() => handleSelectOption(index)}
              disabled={false}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.navButtons}>
          <Pressable
            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentIndex === 0}
          >
            <Ionicons
              name="arrow-forward"
              size={24}
              color={currentIndex === 0 ? Colors.textLight : Colors.primary}
            />
          </Pressable>

          <View style={styles.answeredInfo}>
            <Text style={styles.answeredText}>
              أجبت على {answeredCount} من {questions.length}
            </Text>
          </View>

          <Pressable
            style={[
              styles.navButton,
              currentIndex === questions.length - 1 && styles.navButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={currentIndex === questions.length - 1}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={currentIndex === questions.length - 1 ? Colors.textLight : Colors.primary}
            />
          </Pressable>
        </View>

        <PrimaryButton
          title={`إنهاء الامتحان (${answeredCount}/${questions.length})`}
          onPress={handleFinish}
          variant={answeredCount === questions.length ? 'primary' : 'secondary'}
        />
      </View>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  questionCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  placeholder: {
    width: 44,
  },
  progressIndicator: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 16,
  },
  progressDotAnswered: {
    backgroundColor: Colors.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 32,
  },
  options: {
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  answeredInfo: {
    flex: 1,
    alignItems: 'center',
  },
  answeredText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  resultIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  resultStats: {
    marginBottom: 24,
  },
  resultMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  resultButtons: {
    width: '100%',
  },
  reviewQuestion: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  reviewBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCorrect: {
    backgroundColor: Colors.success,
  },
  reviewWrong: {
    backgroundColor: Colors.danger,
  },
  reviewQuestionText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 24,
  },
  reviewAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  reviewCorrectAnswer: {
    fontSize: 14,
    color: Colors.success,
    textAlign: 'right',
    marginTop: 4,
  },
  reviewSolution: {
    fontSize: 13,
    color: Colors.primaryLight,
    textAlign: 'right',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 22,
  },
});
