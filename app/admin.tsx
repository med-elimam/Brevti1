import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TextInput, Pressable,
  ActivityIndicator, Platform, Alert, Switch, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

const ADMIN_TOKEN_KEY = 'ADMIN_TOKEN';
const TABS = [
  { key: 'subjects', label: 'المواد', icon: 'book' as const },
  { key: 'lessons', label: 'الدروس', icon: 'document-text' as const },
  { key: 'sources', label: 'المصادر', icon: 'cloud-upload' as const },
  { key: 'questions', label: 'الأسئلة', icon: 'help-circle' as const },
  { key: 'exams', label: 'الامتحانات', icon: 'clipboard' as const },
  { key: 'ai', label: 'AI', icon: 'sparkles' as const },
];

const BLOCK_TYPES = [
  { key: 'heading', label: 'عنوان', icon: 'text' as const },
  { key: 'text', label: 'شرح', icon: 'document-text' as const },
  { key: 'formula', label: 'صيغة', icon: 'calculator' as const },
  { key: 'example', label: 'مثال', icon: 'bulb' as const },
  { key: 'warning', label: 'تحذير', icon: 'warning' as const },
  { key: 'exercise', label: 'تمرين', icon: 'fitness' as const },
];

function confirmAction(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert('تأكيد', message, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function Msg({ msg }: { msg: { type: string; text: string } | null }) {
  if (!msg) return null;
  return <Text style={[s.msg, msg.type === 'error' ? s.msgErr : s.msgOk]}>{msg.text}</Text>;
}

function Btn({ title, onPress, color, disabled, loading, icon, small }: any) {
  return (
    <Pressable style={[s.btn, { backgroundColor: color || Colors.primary }, small && s.btnSmall, disabled && s.dis]} onPress={onPress} disabled={disabled || loading}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : (
        <View style={s.btnRow}>
          {icon && <Ionicons name={icon} size={small ? 14 : 16} color="#fff" style={{ marginLeft: 4 }} />}
          <Text style={[s.btnTxt, small && { fontSize: 12 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Field({ label, value, onChangeText, multiline, placeholder, keyboardType, editable }: any) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={[s.input, multiline && s.inputMulti, editable === false && { opacity: 0.6 }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#999"
        multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} keyboardType={keyboardType} editable={editable} />
    </View>
  );
}

function SubjectPicker({ subjects, selected, onSelect }: { subjects: any[]; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerRow} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 4 }}>
      {subjects.map((sub: any) => (
        <Pressable key={sub.id} style={[s.chip, selected === sub.id && s.chipActive]} onPress={() => onSelect(sub.id)}>
          <Text style={[s.chipTxt, selected === sub.id && s.chipTxtActive]}>{sub.name_ar}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function LessonPicker({ lessons, selected, onSelect, label }: { lessons: any[]; selected: number | null; onSelect: (id: number | null) => void; label?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label || 'الدرس'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 4, paddingVertical: 2 }}>
        <Pressable style={[s.chipSm, selected === null && s.chipSmActive]} onPress={() => onSelect(null)}>
          <Text style={[s.chipSmTxt, selected === null && s.chipSmTxtActive]}>الكل</Text>
        </Pressable>
        {lessons.map((l: any) => (
          <Pressable key={l.id} style={[s.chipSm, selected === l.id && s.chipSmActive]} onPress={() => onSelect(l.id)}>
            <Text style={[s.chipSmTxt, selected === l.id && s.chipSmTxtActive]} numberOfLines={1}>{l.order_index}. {l.title_ar?.substring(0, 25)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Badge({ count, color }: { count: number; color?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color || Colors.primary }]}>
      <Text style={s.badgeTxt}>{count}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [activeTab, setActiveTab] = useState('subjects');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const api = useCallback(async (method: string, path: string, body?: any, isFormData?: boolean) => {
    const baseUrl = getApiUrl();
    const headers: any = { 'X-Admin-Token': adminToken };
    if (!isFormData && body) headers['Content-Type'] = 'application/json';
    const res = await globalThis.fetch(new URL(path, baseUrl).toString(), {
      method, headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error');
    return data;
  }, [adminToken]);

  useEffect(() => { loadStoredToken(); }, []);

  const loadStoredToken = async () => {
    try {
      const t = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
      if (t) { setTokenInput(t); verifyToken(t); }
    } catch (_) {}
  };

  const verifyToken = async (token: string) => {
    setIsVerifying(true);
    try {
      const baseUrl = getApiUrl();
      const res = await globalThis.fetch(new URL('/api/admin/verify', baseUrl).toString(), { headers: { 'X-Admin-Token': token } });
      const data = await res.json();
      if (data.valid) {
        setAdminToken(token); setIsAuthenticated(true);
        await AsyncStorage.setItem(ADMIN_TOKEN_KEY, token);
      } else { setMsg({ type: 'error', text: 'رمز غير صالح' }); }
    } catch { setMsg({ type: 'error', text: 'فشل التحقق' }); }
    finally { setIsVerifying(false); }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
    setIsAuthenticated(false); setAdminToken(''); setTokenInput('');
  };

  const loadSubjects = useCallback(async () => {
    try { const d = await api('GET', '/api/admin/subjects'); setSubjects(d); } catch {}
  }, [api]);

  useEffect(() => { if (isAuthenticated) loadSubjects(); }, [isAuthenticated, loadSubjects]);

  if (!isAuthenticated) {
    return (
      <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
        <Header onBack={() => router.back()} title="لوحة الإدارة" />
        <View style={s.loginBox}>
          <Ionicons name="shield-checkmark" size={48} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
          <Text style={s.loginTitle}>أدخل رمز الإدارة</Text>
          <TextInput style={s.tokenInput} value={tokenInput} onChangeText={setTokenInput} placeholder="ADMIN_TOKEN" placeholderTextColor="#999" secureTextEntry autoCapitalize="none" />
          <Msg msg={msg} />
          <Btn title="دخول" onPress={() => verifyToken(tokenInput)} disabled={isVerifying || !tokenInput} loading={isVerifying} icon="log-in-outline" />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <Header onBack={() => router.back()} title="لوحة الإدارة" onLogout={logout} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
        {TABS.map(tab => (
          <Pressable key={tab.key} style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.key); }}>
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#fff' : Colors.text} />
            <Text style={[s.tabTxt, activeTab === tab.key && s.tabTxtActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={s.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'subjects' && <SubjectsTab api={api} subjects={subjects} reload={loadSubjects} />}
        {activeTab === 'lessons' && <LessonsTab api={api} subjects={subjects} />}
        {activeTab === 'sources' && <SourcesTab api={api} subjects={subjects} adminToken={adminToken} />}
        {activeTab === 'questions' && <QuestionsTab api={api} subjects={subjects} />}
        {activeTab === 'exams' && <ExamsTab api={api} subjects={subjects} />}
        {activeTab === 'ai' && <AITab api={api} subjects={subjects} />}
      </ScrollView>
    </View>
  );
}

function Header({ onBack, title, onLogout }: { onBack: () => void; title: string; onLogout?: () => void }) {
  return (
    <View style={s.header}>
      <Pressable style={s.headerBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}>
        <Ionicons name="arrow-forward" size={22} color={Colors.text} />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      {onLogout && <Pressable style={s.headerBtn} onPress={onLogout}><Ionicons name="log-out-outline" size={20} color={Colors.danger} /></Pressable>}
    </View>
  );
}

function SubjectsTab({ api, subjects, reload }: { api: any; subjects: any[]; reload: () => void }) {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name_ar: '', color: '#3498DB', icon: 'book', order_index: '0', is_active: true });
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => { setForm({ key: '', name_ar: '', color: '#3498DB', icon: 'book', order_index: '0', is_active: true }); setEditing(null); setShowForm(false); };

  const startEdit = (sub: any) => {
    setEditing(sub); setShowForm(true);
    setForm({ key: sub.key || '', name_ar: sub.name_ar, color: sub.color || '#3498DB', icon: sub.icon || 'book', order_index: String(sub.order_index ?? 0), is_active: sub.is_active !== 0 });
  };

  const save = async () => {
    if (!form.name_ar.trim()) { setMsg({ type: 'error', text: 'الاسم مطلوب' }); return; }
    setLoading(true); setMsg(null);
    try {
      if (editing) {
        await api('PUT', `/api/admin/subjects/${editing.id}`, { name_ar: form.name_ar, color: form.color, icon: form.icon, order_index: Number(form.order_index), is_active: form.is_active ? 1 : 0 });
      } else {
        if (!form.key.trim()) { setMsg({ type: 'error', text: 'المفتاح مطلوب' }); setLoading(false); return; }
        await api('POST', '/api/admin/subjects', { key: form.key, name_ar: form.name_ar, color: form.color, icon: form.icon, order_index: Number(form.order_index) });
      }
      setMsg({ type: 'success', text: editing ? 'تم التحديث' : 'تمت الإضافة' });
      resetForm(); reload();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(false); }
  };

  const del = (id: number) => {
    confirmAction('هل أنت متأكد من حذف هذه المادة؟ سيتم حذف جميع الدروس والأسئلة المرتبطة بها.', async () => {
      try { await api('DELETE', `/api/admin/subjects/${id}`); setMsg({ type: 'success', text: 'تم الحذف' }); reload(); }
      catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    });
  };

  return (
    <View>
      <View style={s.secHeader}>
        <Text style={s.secTitle}>إدارة المواد</Text>
        <Badge count={subjects.length} />
        {!showForm && <Btn title="إضافة" onPress={() => setShowForm(true)} color={Colors.success} icon="add" small />}
      </View>
      <Msg msg={msg} />
      {showForm && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{editing ? 'تعديل مادة' : 'إضافة مادة جديدة'}</Text>
          {!editing && <Field label="المفتاح (key)" value={form.key} onChangeText={(v: string) => setForm({ ...form, key: v })} placeholder="مثال: math" />}
          <Field label="الاسم بالعربية" value={form.name_ar} onChangeText={(v: string) => setForm({ ...form, name_ar: v })} placeholder="مثال: الرياضيات" />
          <View style={s.rowFields}>
            <View style={{ flex: 1 }}><Field label="اللون" value={form.color} onChangeText={(v: string) => setForm({ ...form, color: v })} /></View>
            <View style={{ flex: 1 }}><Field label="الأيقونة" value={form.icon} onChangeText={(v: string) => setForm({ ...form, icon: v })} /></View>
            <View style={{ flex: 1 }}><Field label="الترتيب" value={form.order_index} onChangeText={(v: string) => setForm({ ...form, order_index: v })} keyboardType="numeric" /></View>
          </View>
          {editing && (
            <View style={s.switchRow}>
              <Text style={s.fieldLabel}>نشط</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm({ ...form, is_active: v })} trackColor={{ true: Colors.success }} />
            </View>
          )}
          <View style={s.btnGroup}>
            <Btn title={editing ? 'تحديث' : 'إضافة'} onPress={save} loading={loading} color={Colors.success} icon="checkmark" />
            <Btn title="إلغاء" onPress={resetForm} color={Colors.textSecondary} />
          </View>
        </View>
      )}
      {subjects.map(sub => (
        <View key={sub.id} style={s.listItem}>
          <View style={[s.colorDot, { backgroundColor: sub.color || Colors.primary }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.listTitle}>{sub.name_ar}</Text>
            <Text style={s.listSub}>key: {sub.key} | ترتيب: {sub.order_index} | {sub.is_active ? 'نشط' : 'معطل'}</Text>
          </View>
          <View style={s.listActions}>
            <Pressable onPress={() => startEdit(sub)} hitSlop={8}><Ionicons name="create-outline" size={20} color={Colors.primary} /></Pressable>
            <Pressable onPress={() => del(sub.id)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function LessonsTab({ api, subjects }: { api: any; subjects: any[] }) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title_ar: '', order_index: '0', status: 'draft', summary_ar: '' });
  const [blocks, setBlocks] = useState<any[]>([]);
  const [editingBlockIdx, setEditingBlockIdx] = useState<number | null>(null);
  const [blockForm, setBlockForm] = useState({ type: 'text', title: '', content: '' });
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const load = async (sid: number) => {
    setSubjectId(sid); setEditing(null); setShowForm(false); setFetching(true);
    try { const d = await api('GET', `/api/admin/lessons?subject_id=${sid}`); setLessons(d); } catch {}
    finally { setFetching(false); }
  };

  const resetForm = () => {
    setForm({ title_ar: '', order_index: '0', status: 'draft', summary_ar: '' });
    setBlocks([]); setEditing(null); setShowForm(false); setEditingBlockIdx(null);
  };

  const startEdit = (l: any) => {
    setEditing(l); setShowForm(true);
    setForm({ title_ar: l.title_ar || '', order_index: String(l.order_index ?? 0), status: l.status || 'draft', summary_ar: l.summary_ar || '' });
    try { setBlocks(JSON.parse(l.content_blocks_json || '[]')); } catch { setBlocks([]); }
    setEditingBlockIdx(null);
  };

  const save = async () => {
    if (!subjectId || !form.title_ar.trim()) { setMsg({ type: 'error', text: 'العنوان مطلوب' }); return; }
    setLoading(true); setMsg(null);
    try {
      const body = { ...form, order_index: Number(form.order_index), subject_id: subjectId, content_blocks_json: JSON.stringify(blocks) };
      if (editing) await api('PUT', `/api/admin/lessons/${editing.id}`, body);
      else await api('POST', '/api/admin/lessons', body);
      setMsg({ type: 'success', text: editing ? 'تم التحديث' : 'تمت الإضافة' });
      resetForm(); load(subjectId);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(false); }
  };

  const del = (id: number) => {
    confirmAction('هل أنت متأكد من حذف هذا الدرس؟', async () => {
      try { await api('DELETE', `/api/admin/lessons/${id}`); if (subjectId) load(subjectId); } catch {}
    });
  };

  const toggleStatus = async (l: any) => {
    const newStatus = l.status === 'published' ? 'draft' : 'published';
    try { await api('PUT', `/api/admin/lessons/${l.id}`, { status: newStatus }); if (subjectId) load(subjectId); } catch {}
  };

  const addBlock = () => {
    setBlocks([...blocks, { type: 'text', title: '', content: '' }]);
    setEditingBlockIdx(blocks.length);
    setBlockForm({ type: 'text', title: '', content: '' });
  };

  const saveBlock = () => {
    if (editingBlockIdx === null) return;
    const updated = [...blocks];
    updated[editingBlockIdx] = { ...blockForm };
    setBlocks(updated);
    setEditingBlockIdx(null);
  };

  const deleteBlock = (idx: number) => {
    setBlocks(blocks.filter((_, i) => i !== idx));
    if (editingBlockIdx === idx) setEditingBlockIdx(null);
  };

  const moveBlock = (idx: number, dir: number) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const updated = [...blocks];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setBlocks(updated);
  };

  const startEditBlock = (idx: number) => {
    setEditingBlockIdx(idx);
    setBlockForm({ type: blocks[idx].type || 'text', title: blocks[idx].title || '', content: blocks[idx].content || '' });
  };

  return (
    <View>
      <View style={s.secHeader}>
        <Text style={s.secTitle}>إدارة الدروس</Text>
        {subjectId && <Badge count={lessons.length} />}
      </View>
      <SubjectPicker subjects={subjects} selected={subjectId} onSelect={load} />
      <Msg msg={msg} />
      {fetching && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {subjectId && !fetching && (
        <>
          {!showForm && <Btn title="إضافة درس جديد" onPress={() => setShowForm(true)} color={Colors.success} icon="add" />}
          {showForm && (
            <View style={s.card}>
              <Text style={s.cardTitle}>{editing ? 'تعديل درس' : 'إضافة درس جديد'}</Text>
              <Field label="العنوان بالعربية" value={form.title_ar} onChangeText={(v: string) => setForm({ ...form, title_ar: v })} />
              <View style={s.rowFields}>
                <View style={{ flex: 1 }}><Field label="الترتيب" value={form.order_index} onChangeText={(v: string) => setForm({ ...form, order_index: v })} keyboardType="numeric" /></View>
                <View style={{ flex: 2 }}>
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>الحالة</Text>
                    <View style={s.statusRow}>
                      {['draft', 'published'].map(st => (
                        <Pressable key={st} style={[s.chip, form.status === st && s.chipActive]} onPress={() => setForm({ ...form, status: st })}>
                          <Text style={[s.chipTxt, form.status === st && s.chipTxtActive]}>{st === 'draft' ? 'مسودة' : 'منشور'}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
              <Field label="الملخص" value={form.summary_ar} onChangeText={(v: string) => setForm({ ...form, summary_ar: v })} multiline placeholder="ملخص قصير عن الدرس..." />

              <View style={s.blocksSection}>
                <View style={s.blocksHeader}>
                  <Text style={s.blocksSectionTitle}>كتل المحتوى ({blocks.length})</Text>
                  <Btn title="إضافة كتلة" onPress={addBlock} color={Colors.accent} icon="add" small />
                </View>

                {editingBlockIdx !== null && (
                  <View style={s.blockEditCard}>
                    <Text style={s.blockEditTitle}>تعديل الكتلة #{editingBlockIdx + 1}</Text>
                    <View style={s.field}>
                      <Text style={s.fieldLabel}>النوع</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 4 }}>
                        {BLOCK_TYPES.map(bt => (
                          <Pressable key={bt.key} style={[s.chipSm, blockForm.type === bt.key && s.chipSmActive]}
                            onPress={() => setBlockForm({ ...blockForm, type: bt.key })}>
                            <Ionicons name={bt.icon} size={12} color={blockForm.type === bt.key ? '#fff' : Colors.text} />
                            <Text style={[s.chipSmTxt, blockForm.type === bt.key && s.chipSmTxtActive]}>{bt.label}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    <Field label="العنوان" value={blockForm.title} onChangeText={(v: string) => setBlockForm({ ...blockForm, title: v })} />
                    <Field label="المحتوى" value={blockForm.content} onChangeText={(v: string) => setBlockForm({ ...blockForm, content: v })} multiline placeholder={blockForm.type === 'formula' ? 'استخدم LaTeX: \\(x^2 + 1\\)' : 'اكتب المحتوى...'} />
                    <View style={s.btnGroup}>
                      <Btn title="حفظ الكتلة" onPress={saveBlock} color={Colors.success} icon="checkmark" small />
                      <Btn title="إلغاء" onPress={() => setEditingBlockIdx(null)} color={Colors.textSecondary} small />
                    </View>
                  </View>
                )}

                {blocks.map((block, idx) => (
                  <View key={idx} style={[s.blockItem, editingBlockIdx === idx && s.blockItemEditing]}>
                    <View style={s.blockItemLeft}>
                      <Pressable onPress={() => moveBlock(idx, -1)} hitSlop={6}><Ionicons name="chevron-up" size={16} color={Colors.textSecondary} /></Pressable>
                      <Pressable onPress={() => moveBlock(idx, 1)} hitSlop={6}><Ionicons name="chevron-down" size={16} color={Colors.textSecondary} /></Pressable>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.blockItemHeader}>
                        <Ionicons name={BLOCK_TYPES.find(bt => bt.key === block.type)?.icon || 'document-text'} size={14} color={Colors.accent} />
                        <Text style={s.blockTypeLabel}>{BLOCK_TYPES.find(bt => bt.key === block.type)?.label || block.type}</Text>
                        {block.title ? <Text style={s.blockTitle} numberOfLines={1}> - {block.title}</Text> : null}
                      </View>
                      <Text style={s.blockPreview} numberOfLines={2}>{block.content || '(فارغ)'}</Text>
                    </View>
                    <View style={s.listActions}>
                      <Pressable onPress={() => startEditBlock(idx)} hitSlop={8}><Ionicons name="create-outline" size={18} color={Colors.primary} /></Pressable>
                      <Pressable onPress={() => deleteBlock(idx)} hitSlop={8}><Ionicons name="close-circle-outline" size={18} color={Colors.danger} /></Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[s.btnGroup, { marginTop: 12 }]}>
                <Btn title={editing ? 'حفظ التعديلات' : 'إنشاء الدرس'} onPress={save} loading={loading} color={Colors.success} icon="checkmark" />
                <Btn title="إلغاء" onPress={resetForm} color={Colors.textSecondary} />
              </View>
            </View>
          )}

          {lessons.map(l => (
            <View key={l.id} style={s.listItem}>
              <View style={[s.statusDot, { backgroundColor: l.status === 'published' ? Colors.success : Colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.listTitle}>{l.order_index}. {l.title_ar}</Text>
                <Text style={s.listSub}>
                  {l.status === 'published' ? 'منشور' : 'مسودة'}
                  {' | '}
                  {(() => { try { return JSON.parse(l.content_blocks_json || '[]').length; } catch { return 0; } })()} كتلة
                </Text>
              </View>
              <View style={s.listActions}>
                <Pressable onPress={() => toggleStatus(l)} hitSlop={8}>
                  <Ionicons name={l.status === 'published' ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.accent} />
                </Pressable>
                <Pressable onPress={() => startEdit(l)} hitSlop={8}><Ionicons name="create-outline" size={20} color={Colors.primary} /></Pressable>
                <Pressable onPress={() => del(l.id)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function SourcesTab({ api, subjects, adminToken }: { api: any; subjects: any[]; adminToken: string }) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [msg, setMsg] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadLessons = async (sid: number) => {
    try { const d = await api('GET', `/api/admin/lessons?subject_id=${sid}`); setLessons(d); } catch {}
  };

  const load = async (sid: number) => {
    setSubjectId(sid); setLessonId(null); setFetching(true);
    loadLessons(sid);
    try { const d = await api('GET', `/api/admin/sources?subject_id=${sid}`); setSources(d); } catch {}
    finally { setFetching(false); }
  };

  const pickAndUpload = async () => {
    if (!subjectId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true); setMsg(null);
      const formData = new FormData();

if (Platform.OS === 'web') {
  // في الويب: استعمل File الحقيقي
  const blob = await fetch(file.uri).then(r => r.blob());
  const webFile = new File([blob], file.name, { type: file.mimeType || 'application/octet-stream' });
  formData.append('file', webFile);
} else {
  // في الهاتف: نفس الكود الحالي
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as any);
}

      formData.append('subject_id', String(subjectId));
      if (lessonId) formData.append('lesson_id', String(lessonId));

      
      const baseUrl = getApiUrl();
      const res = await globalThis.fetch(new URL('/api/admin/sources/upload', baseUrl).toString(), {
        method: 'POST', headers: { 'X-Admin-Token': adminToken }, body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'فشل الرفع'); }
      const data = await res.json();
      setMsg({ type: 'success', text: `تم رفع الملف (${data.extracted_text_length || 0} حرف مستخرج)` });
      load(subjectId);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setUploading(false); }
  };

  const del = (id: number) => {
    confirmAction('هل أنت متأكد من حذف هذا المصدر؟', async () => {
      try { await api('DELETE', `/api/admin/sources/${id}`); setMsg({ type: 'success', text: 'تم الحذف' }); if (subjectId) load(subjectId); }
      catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    });
  };

  const saveEdit = async () => {
    if (!editingSource) return;
    try {
      await api('PUT', `/api/admin/sources/${editingSource.id}`, { extracted_text: editText });
      setMsg({ type: 'success', text: 'تم التحديث' });
      setEditingSource(null); if (subjectId) load(subjectId);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'pdf') return 'document-text';
    if (type === 'image') return 'image';
    return 'document';
  };

  const filteredSources = lessonId ? sources.filter(src => src.lesson_id === lessonId) : sources;

  return (
    <View>
      <View style={s.secHeader}>
        <Text style={s.secTitle}>إدارة المصادر</Text>
        {subjectId && <Badge count={filteredSources.length} />}
      </View>
      <SubjectPicker subjects={subjects} selected={subjectId} onSelect={load} />
      <Msg msg={msg} />
      {fetching && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {subjectId && !fetching && (
        <>
          {lessons.length > 0 && (
            <LessonPicker lessons={lessons} selected={lessonId} onSelect={setLessonId} label="تصفية حسب الدرس (اختياري)" />
          )}
          <Btn title="رفع ملف جديد (PDF / صورة)" onPress={pickAndUpload} loading={uploading} color={Colors.primary} icon="cloud-upload-outline" />
          {editingSource && (
            <View style={s.card}>
              <Text style={s.cardTitle}>تعديل النص المستخرج: {editingSource.original_name}</Text>
              <Field label="النص المستخرج" value={editText} onChangeText={setEditText} multiline />
              <View style={s.btnGroup}>
                <Btn title="حفظ" onPress={saveEdit} color={Colors.success} icon="checkmark" />
                <Btn title="إلغاء" onPress={() => setEditingSource(null)} color={Colors.textSecondary} />
              </View>
            </View>
          )}
          {filteredSources.map(src => (
            <View key={src.id} style={s.listItem}>
              <Ionicons name={getTypeIcon(src.type) as any} size={24} color={src.type === 'pdf' ? Colors.danger : Colors.primary} style={{ marginLeft: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.listTitle} numberOfLines={1}>{src.original_name || src.file_name || `مصدر #${src.id}`}</Text>
                <Text style={s.listSub}>
                  {src.type} | {Math.round((src.size || 0) / 1024)} KB | نص: {src.extracted_text?.length ?? 0} حرف
                  {src.lesson_id ? ` | درس #${src.lesson_id}` : ''}
                </Text>
              </View>
              <View style={s.listActions}>
                <Pressable onPress={() => { setEditingSource(src); setEditText(src.extracted_text || ''); }} hitSlop={8}>
                  <Ionicons name="create-outline" size={20} color={Colors.primary} />
                </Pressable>
                <Pressable onPress={() => del(src.id)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></Pressable>
              </View>
            </View>
          ))}
          {filteredSources.length === 0 && <Text style={s.empty}>لا توجد مصادر بعد</Text>}
        </>
      )}
    </View>
  );
}

function QuestionsTab({ api, subjects }: { api: any; subjects: any[] }) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ statement_md: '', option1: '', option2: '', option3: '', option4: '', correct_index: '0', difficulty: 'medium', solution_md: '', lesson_id: '' });
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadLessons = async (sid: number) => {
    try { const d = await api('GET', `/api/admin/lessons?subject_id=${sid}`); setLessons(d); } catch {}
  };

  const load = async (sid?: number, lid?: number | null, diff?: string | null) => {
    const s = sid ?? subjectId;
    if (!s) return;
    setFetching(true);
    let url = `/api/admin/questions?subject_id=${s}`;
    if (lid) url += `&lesson_id=${lid}`;
    if (diff) url += `&difficulty=${diff}`;
    try { const d = await api('GET', url); setQuestions(d); } catch {}
    finally { setFetching(false); }
  };

  const selectSubject = (sid: number) => {
    setSubjectId(sid); setLessonId(null); setDifficulty(null); setShowForm(false); setEditing(null);
    loadLessons(sid); load(sid, null, null);
  };

  const filterByLesson = (lid: number | null) => { setLessonId(lid); load(undefined, lid, difficulty); };
  const filterByDifficulty = (d: string | null) => { setDifficulty(d); load(undefined, lessonId, d); };

  const resetForm = () => {
    setForm({ statement_md: '', option1: '', option2: '', option3: '', option4: '', correct_index: '0', difficulty: 'medium', solution_md: '', lesson_id: '' });
    setEditing(null); setShowForm(false);
  };

  const startEdit = (q: any) => {
    setEditing(q); setShowForm(true);
    const opts = q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : [];
    const correctIdx = q.correct_answer_json ? (typeof q.correct_answer_json === 'string' ? JSON.parse(q.correct_answer_json) : q.correct_answer_json) : 0;
    setForm({
      statement_md: q.statement_md || '', option1: opts[0] || '', option2: opts[1] || '',
      option3: opts[2] || '', option4: opts[3] || '', correct_index: String(correctIdx),
      difficulty: q.difficulty || 'medium', solution_md: q.solution_md || '', lesson_id: q.lesson_id ? String(q.lesson_id) : '',
    });
  };

  const save = async () => {
    if (!subjectId || !form.statement_md.trim()) { setMsg({ type: 'error', text: 'نص السؤال مطلوب' }); return; }
    setLoading(true); setMsg(null);
    const options = [form.option1, form.option2, form.option3, form.option4];
    const body = {
      subject_id: subjectId, lesson_id: form.lesson_id ? Number(form.lesson_id) : null,
      difficulty: form.difficulty, qtype: 'mcq', statement_md: form.statement_md,
      options_json: JSON.stringify(options), correct_answer_json: JSON.stringify(Number(form.correct_index)),
      solution_md: form.solution_md,
    };
    try {
      if (editing) await api('PUT', `/api/admin/questions/${editing.id}`, body);
      else await api('POST', '/api/admin/questions', body);
      setMsg({ type: 'success', text: editing ? 'تم التحديث' : 'تمت الإضافة' });
      resetForm(); load();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(false); }
  };

  const del = (id: number) => {
    confirmAction('هل أنت متأكد من حذف هذا السؤال؟', async () => {
      try { await api('DELETE', `/api/admin/questions/${id}`); load(); } catch {}
    });
  };

  const getDifficultyLabel = (d: string) => d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
  const getDifficultyColor = (d: string) => d === 'easy' ? Colors.success : d === 'medium' ? Colors.warning : Colors.danger;

  return (
    <View>
      <View style={s.secHeader}>
        <Text style={s.secTitle}>بنك الأسئلة</Text>
        {subjectId && <Badge count={questions.length} />}
      </View>
      <SubjectPicker subjects={subjects} selected={subjectId} onSelect={selectSubject} />
      <Msg msg={msg} />
      {subjectId && (
        <>
          {lessons.length > 0 && (
            <LessonPicker lessons={lessons} selected={lessonId} onSelect={filterByLesson} label="تصفية حسب الدرس" />
          )}
          <View style={s.field}>
            <Text style={s.fieldLabel}>تصفية حسب الصعوبة</Text>
            <View style={s.statusRow}>
              <Pressable style={[s.chipSm, difficulty === null && s.chipSmActive]} onPress={() => filterByDifficulty(null)}>
                <Text style={[s.chipSmTxt, difficulty === null && s.chipSmTxtActive]}>الكل</Text>
              </Pressable>
              {['easy', 'medium', 'hard'].map(d => (
                <Pressable key={d} style={[s.chipSm, difficulty === d && s.chipSmActive]} onPress={() => filterByDifficulty(d)}>
                  <Text style={[s.chipSmTxt, difficulty === d && s.chipSmTxtActive]}>{getDifficultyLabel(d)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {!showForm && <Btn title="إضافة سؤال جديد" onPress={() => setShowForm(true)} color={Colors.success} icon="add" />}

          {showForm && (
            <View style={s.card}>
              <Text style={s.cardTitle}>{editing ? 'تعديل سؤال' : 'إضافة سؤال جديد'}</Text>
              <Field label="نص السؤال (يدعم LaTeX)" value={form.statement_md} onChangeText={(v: string) => setForm({ ...form, statement_md: v })} multiline placeholder="اكتب السؤال بالعربية..." />

              {lessons.length > 0 && (
                <View style={s.field}>
                  <Text style={s.fieldLabel}>ربط بالدرس (اختياري)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 4 }}>
                    <Pressable style={[s.chipSm, !form.lesson_id && s.chipSmActive]} onPress={() => setForm({ ...form, lesson_id: '' })}>
                      <Text style={[s.chipSmTxt, !form.lesson_id && s.chipSmTxtActive]}>بدون</Text>
                    </Pressable>
                    {lessons.map(l => (
                      <Pressable key={l.id} style={[s.chipSm, form.lesson_id === String(l.id) && s.chipSmActive]}
                        onPress={() => setForm({ ...form, lesson_id: String(l.id) })}>
                        <Text style={[s.chipSmTxt, form.lesson_id === String(l.id) && s.chipSmTxtActive]} numberOfLines={1}>{l.order_index}. {l.title_ar?.substring(0, 20)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={s.optionsCard}>
                <Text style={s.fieldLabel}>الخيارات</Text>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={s.optionRow}>
                    <Pressable style={[s.optionRadio, Number(form.correct_index) === i && s.optionRadioActive]}
                      onPress={() => setForm({ ...form, correct_index: String(i) })}>
                      {Number(form.correct_index) === i && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </Pressable>
                    <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]}
                      value={[form.option1, form.option2, form.option3, form.option4][i]}
                      onChangeText={(v) => {
                        const key = ['option1', 'option2', 'option3', 'option4'][i] as keyof typeof form;
                        setForm({ ...form, [key]: v });
                      }}
                      placeholder={`الخيار ${i + 1}`} placeholderTextColor="#999" />
                  </View>
                ))}
                <Text style={[s.listSub, { marginTop: 4 }]}>اضغط على الدائرة لتحديد الإجابة الصحيحة</Text>
              </View>

              <View style={s.field}>
                <Text style={s.fieldLabel}>الصعوبة</Text>
                <View style={s.statusRow}>
                  {['easy', 'medium', 'hard'].map(d => (
                    <Pressable key={d} style={[s.chip, form.difficulty === d && { backgroundColor: getDifficultyColor(d), borderColor: getDifficultyColor(d) }]}
                      onPress={() => setForm({ ...form, difficulty: d })}>
                      <Text style={[s.chipTxt, form.difficulty === d && { color: '#fff' }]}>{getDifficultyLabel(d)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Field label="الحل والشرح" value={form.solution_md} onChangeText={(v: string) => setForm({ ...form, solution_md: v })} multiline placeholder="شرح الإجابة..." />
              <View style={s.btnGroup}>
                <Btn title={editing ? 'تحديث' : 'إضافة'} onPress={save} loading={loading} color={Colors.success} icon="checkmark" />
                <Btn title="إلغاء" onPress={resetForm} color={Colors.textSecondary} />
              </View>
            </View>
          )}

          {fetching && <ActivityIndicator style={{ marginVertical: 12 }} />}
          {!fetching && questions.map(q => {
            const opts = (() => { try { return JSON.parse(q.options_json || '[]'); } catch { return []; } })();
            const correctIdx = (() => { try { return JSON.parse(q.correct_answer_json || '0'); } catch { return 0; } })();
            return (
              <View key={q.id} style={s.listItem}>
                <View style={[s.diffDot, { backgroundColor: getDifficultyColor(q.difficulty) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle} numberOfLines={2}>{q.statement_md}</Text>
                  <Text style={s.listSub}>
                    {getDifficultyLabel(q.difficulty)} | {opts.length} خيارات | الصحيح: {opts[correctIdx] || '-'}
                  </Text>
                </View>
                <View style={s.listActions}>
                  <Pressable onPress={() => startEdit(q)} hitSlop={8}><Ionicons name="create-outline" size={20} color={Colors.primary} /></Pressable>
                  <Pressable onPress={() => del(q.id)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></Pressable>
                </View>
              </View>
            );
          })}
          {!fetching && questions.length === 0 && <Text style={s.empty}>لا توجد أسئلة بعد</Text>}
        </>
      )}
    </View>
  );
}

function ExamsTab({ api, subjects }: { api: any; subjects: any[] }) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title_ar: '', year: '', duration_minutes: '60' });
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [assignExam, setAssignExam] = useState<any>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<Set<number>>(new Set());

  const load = async (sid: number) => {
    setSubjectId(sid); setShowForm(false); setEditing(null); setAssignExam(null); setFetching(true);
    try { const d = await api('GET', `/api/admin/exams?subject_id=${sid}`); setExams(d); } catch {}
    finally { setFetching(false); }
  };

  const resetForm = () => { setForm({ title_ar: '', year: '', duration_minutes: '60' }); setEditing(null); setShowForm(false); };

  const startEdit = (e: any) => {
    setEditing(e); setShowForm(true);
    setForm({ title_ar: e.title_ar || '', year: String(e.year || ''), duration_minutes: String(e.duration_minutes || 60) });
  };

  const save = async () => {
    if (!subjectId || !form.title_ar.trim()) { setMsg({ type: 'error', text: 'العنوان مطلوب' }); return; }
    setLoading(true); setMsg(null);
    const body = { subject_id: subjectId, title_ar: form.title_ar, year: form.year ? Number(form.year) : null, duration_minutes: Number(form.duration_minutes) };
    try {
      if (editing) await api('PUT', `/api/admin/exams/${editing.id}`, body);
      else await api('POST', '/api/admin/exams', body);
      setMsg({ type: 'success', text: editing ? 'تم التحديث' : 'تمت الإضافة' });
      resetForm(); load(subjectId);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(false); }
  };

  const del = (id: number) => {
    confirmAction('هل أنت متأكد من حذف هذا الامتحان؟', async () => {
      try { await api('DELETE', `/api/admin/exams/${id}`); if (subjectId) load(subjectId); } catch {}
    });
  };

  const openAssign = async (exam: any) => {
    setAssignExam(exam);
    try {
      const [eq, aq] = await Promise.all([
        api('GET', `/api/admin/exams/${exam.id}/questions`),
        api('GET', `/api/admin/questions?subject_id=${subjectId}`),
      ]);
      setExamQuestions(eq);
      setAllQuestions(aq);
      setSelectedQIds(new Set(eq.map((q: any) => q.id)));
    } catch {}
  };

  const toggleQuestion = (qid: number) => {
    setSelectedQIds(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
  };

  const saveAssignment = async () => {
    if (!assignExam) return;
    const ids = Array.from(selectedQIds);
    try {
      await api('PUT', `/api/admin/exams/${assignExam.id}/questions`, { question_ids: ids });
      setMsg({ type: 'success', text: `تم تعيين ${ids.length} سؤال` });
      const eq = await api('GET', `/api/admin/exams/${assignExam.id}/questions`);
      setExamQuestions(eq);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const getDifficultyLabel = (d: string) => d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب';
  const getDifficultyColor = (d: string) => d === 'easy' ? Colors.success : d === 'medium' ? Colors.warning : Colors.danger;

  return (
    <View>
      <View style={s.secHeader}>
        <Text style={s.secTitle}>بناء الامتحانات</Text>
        {subjectId && <Badge count={exams.length} />}
      </View>
      <SubjectPicker subjects={subjects} selected={subjectId} onSelect={load} />
      <Msg msg={msg} />
      {fetching && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {subjectId && !fetching && (
        <>
          {!showForm && !assignExam && <Btn title="إنشاء امتحان جديد" onPress={() => setShowForm(true)} color={Colors.success} icon="add" />}

          {showForm && (
            <View style={s.card}>
              <Text style={s.cardTitle}>{editing ? 'تعديل امتحان' : 'إنشاء امتحان جديد'}</Text>
              <Field label="العنوان" value={form.title_ar} onChangeText={(v: string) => setForm({ ...form, title_ar: v })} placeholder="مثال: امتحان الرياضيات 2024" />
              <View style={s.rowFields}>
                <View style={{ flex: 1 }}><Field label="السنة" value={form.year} onChangeText={(v: string) => setForm({ ...form, year: v })} keyboardType="numeric" placeholder="2024" /></View>
                <View style={{ flex: 1 }}><Field label="المدة (دقيقة)" value={form.duration_minutes} onChangeText={(v: string) => setForm({ ...form, duration_minutes: v })} keyboardType="numeric" /></View>
              </View>
              <View style={s.btnGroup}>
                <Btn title={editing ? 'تحديث' : 'إنشاء'} onPress={save} loading={loading} color={Colors.success} icon="checkmark" />
                <Btn title="إلغاء" onPress={resetForm} color={Colors.textSecondary} />
              </View>
            </View>
          )}

          {assignExam && (
            <View style={s.card}>
              <View style={s.secHeader}>
                <Text style={s.cardTitle}>تعيين أسئلة: {assignExam.title_ar}</Text>
                <Badge count={selectedQIds.size} color={Colors.accent} />
              </View>
              <Text style={[s.listSub, { marginBottom: 8 }]}>حدد الأسئلة التي تريد تضمينها في الامتحان</Text>

              {allQuestions.map(q => (
                <Pressable key={q.id} style={[s.questionCheckItem, selectedQIds.has(q.id) && s.questionCheckItemSelected]}
                  onPress={() => toggleQuestion(q.id)}>
                  <Ionicons name={selectedQIds.has(q.id) ? 'checkbox' : 'square-outline'} size={22}
                    color={selectedQIds.has(q.id) ? Colors.success : Colors.textSecondary} />
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.listTitle} numberOfLines={2}>{q.statement_md}</Text>
                    <Text style={[s.listSub, { color: getDifficultyColor(q.difficulty) }]}>{getDifficultyLabel(q.difficulty)}</Text>
                  </View>
                </Pressable>
              ))}
              {allQuestions.length === 0 && <Text style={s.empty}>لا توجد أسئلة لهذه المادة. أضف أسئلة أولاً.</Text>}

              <View style={[s.btnGroup, { marginTop: 12 }]}>
                <Btn title={`حفظ (${selectedQIds.size} سؤال)`} onPress={saveAssignment} color={Colors.success} icon="checkmark" />
                <Btn title="إغلاق" onPress={() => setAssignExam(null)} color={Colors.textSecondary} />
              </View>
            </View>
          )}

          {!assignExam && exams.map(e => (
            <View key={e.id} style={s.listItem}>
              <Ionicons name="clipboard-outline" size={24} color={Colors.primary} style={{ marginLeft: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.listTitle}>{e.title_ar}</Text>
                <Text style={s.listSub}>سنة: {e.year || '-'} | المدة: {e.duration_minutes} دقيقة</Text>
              </View>
              <View style={s.listActions}>
                <Pressable onPress={() => openAssign(e)} hitSlop={8}><Ionicons name="list-outline" size={20} color={Colors.accent} /></Pressable>
                <Pressable onPress={() => startEdit(e)} hitSlop={8}><Ionicons name="create-outline" size={20} color={Colors.primary} /></Pressable>
                <Pressable onPress={() => del(e.id)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></Pressable>
              </View>
            </View>
          ))}
          {exams.length === 0 && !showForm && <Text style={s.empty}>لا توجد امتحانات بعد</Text>}
        </>
      )}
    </View>
  );
}

function AITab({ api, subjects }: { api: any; subjects: any[] }) {
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);

  const [lessonBlocksForm, setLessonBlocksForm] = useState({ lesson_id: null as number | null, source_ids: new Set<number>() });
  const [qForm, setQForm] = useState({ lesson_id: null as number | null, source_ids: new Set<number>(), count: '5', easy: '30', medium: '40', hard: '30' });
  const [examForm, setExamForm] = useState({ exam_id: null as number | null, source_ids: new Set<number>() });
  const [langMode, setLangMode] = useState<{ mode: string; label_ar: string } | null>(null);

  const loadSubjectData = async (sid: number) => {
    setSelectedSubject(sid);
    setLangMode(null);
    setLessonBlocksForm({ lesson_id: null, source_ids: new Set() });
    setQForm({ lesson_id: null, source_ids: new Set(), count: '5', easy: '30', medium: '40', hard: '30' });
    setExamForm({ exam_id: null, source_ids: new Set() });
    try {
      const [l, s, e] = await Promise.all([
        api('GET', `/api/admin/lessons?subject_id=${sid}`),
        api('GET', `/api/admin/sources?subject_id=${sid}`),
        api('GET', `/api/admin/exams?subject_id=${sid}`),
      ]);
      setLessons(l); setSources(s); setExams(e);
    } catch {}
    try {
      const lm = await api('GET', `/api/admin/subject-language-mode/${sid}`);
      setLangMode(lm);
    } catch { setLangMode(null); }
  };

  const toggleSourceId = (set: Set<number>, id: number): Set<number> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const SourcePicker = ({ selected, onToggle }: { selected: Set<number>; onToggle: (id: number) => void }) => (
    <View style={s.field}>
      <Text style={s.fieldLabel}>المصادر المتاحة ({sources.length})</Text>
      {sources.length === 0 && <Text style={s.empty}>لا توجد مصادر. ارفع مصادر أولاً.</Text>}
      {sources.map(src => (
        <Pressable key={src.id} style={[s.sourceCheckItem, selected.has(src.id) && s.sourceCheckItemSelected]}
          onPress={() => onToggle(src.id)}>
          <Ionicons name={selected.has(src.id) ? 'checkbox' : 'square-outline'} size={20}
            color={selected.has(src.id) ? Colors.success : Colors.textSecondary} />
          <Text style={s.sourceCheckTxt} numberOfLines={1}>{src.original_name || `مصدر #${src.id}`} ({src.extracted_text?.length || 0} حرف)</Text>
        </Pressable>
      ))}
    </View>
  );

  const genLessonBlocks = async () => {
    if (!lessonBlocksForm.lesson_id) { setMsg({ type: 'error', text: 'يجب اختيار الدرس' }); return; }
    if (lessonBlocksForm.source_ids.size === 0) { setMsg({ type: 'error', text: 'يجب اختيار مصدر واحد على الأقل' }); return; }
    setLoading('lesson'); setMsg(null); setResult(null);
    try {
      const d = await api('POST', '/api/admin/ai/generate-lesson-blocks', {
        lesson_id: lessonBlocksForm.lesson_id,
        source_ids: Array.from(lessonBlocksForm.source_ids),
      });
      setResult(`تم توليد ${d.blocks_count} كتلة محتوى للدرس`);
      setMsg({ type: 'success', text: 'تم التوليد بنجاح وتم حفظ الكتل في الدرس' });
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); }
  };

  const genQuestions = async () => {
    if (!selectedSubject) return;
    if (qForm.source_ids.size === 0) { setMsg({ type: 'error', text: 'يجب اختيار مصدر واحد على الأقل' }); return; }
    setLoading('questions'); setMsg(null); setResult(null);
    try {
      const d = await api('POST', '/api/admin/ai/generate-questions', {
        subject_id: selectedSubject, lesson_id: qForm.lesson_id,
        source_ids: Array.from(qForm.source_ids), count: Number(qForm.count),
        difficulty_distribution: { easy: Number(qForm.easy), medium: Number(qForm.medium), hard: Number(qForm.hard) },
      });
      setResult(`تم توليد ${d.question_ids?.length || 0} سؤال وحفظها في بنك الأسئلة`);
      setMsg({ type: 'success', text: 'تم التوليد بنجاح' });
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); }
  };

  const genExamVariant = async () => {
    if (!examForm.exam_id) { setMsg({ type: 'error', text: 'يجب اختيار الامتحان' }); return; }
    if (examForm.source_ids.size === 0) { setMsg({ type: 'error', text: 'يجب اختيار مصدر واحد على الأقل' }); return; }
    setLoading('exam'); setMsg(null); setResult(null);
    try {
      const d = await api('POST', '/api/admin/ai/generate-exam-variant', {
        exam_id: examForm.exam_id,
        source_ids: Array.from(examForm.source_ids),
      });
      setResult(`تم إنشاء نسخة بديلة (امتحان #${d.exam_id}) تحتوي على ${d.question_count} سؤال`);
      setMsg({ type: 'success', text: 'تم التوليد بنجاح' });
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); }
  };

  return (
    <View>
      <Text style={s.secTitle}>أدوات الذكاء الاصطناعي</Text>
      <Text style={[s.listSub, { marginBottom: 8 }]}>اختر المادة أولاً لعرض الدروس والمصادر المتاحة</Text>
      <SubjectPicker subjects={subjects} selected={selectedSubject} onSelect={loadSubjectData} />
      <Msg msg={msg} />

      {selectedSubject && langMode && (
        <View style={{ backgroundColor: Colors.primary + '15', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.primary + '30', flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Ionicons name="language" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600', textAlign: 'right' }}>
              نمط اللغة: {langMode.label_ar}
            </Text>
            <Text style={{ fontSize: 11, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 }}>
              {langMode.mode === 'ar_fr_terms' ? 'الشرح بالعربية مع الحفاظ على المصطلحات العلمية بالفرنسية' :
               langMode.mode === 'fr_only' ? 'المحتوى بالفرنسية' :
               'المحتوى بالعربية فقط'}
            </Text>
          </View>
        </View>
      )}

      {result && (
        <View style={[s.card, { backgroundColor: Colors.success + '10', borderColor: Colors.success }]}>
          <Text style={[s.cardTitle, { color: Colors.success }]}>النتيجة</Text>
          <Text style={{ fontSize: 14, color: Colors.text, textAlign: 'right' }}>{result}</Text>
        </View>
      )}

      {selectedSubject && (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>توليد كتل الدرس</Text>
            <Text style={s.listSub}>يقوم بتحليل المصادر وتوليد محتوى منظم للدرس المحدد</Text>
            <View style={s.field}>
              <Text style={s.fieldLabel}>اختر الدرس</Text>
              {lessons.length === 0 && <Text style={s.empty}>لا توجد دروس. أضف دروساً أولاً.</Text>}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 4 }}>
                {lessons.map(l => (
                  <Pressable key={l.id} style={[s.chipSm, lessonBlocksForm.lesson_id === l.id && s.chipSmActive]}
                    onPress={() => setLessonBlocksForm({ ...lessonBlocksForm, lesson_id: l.id })}>
                    <Text style={[s.chipSmTxt, lessonBlocksForm.lesson_id === l.id && s.chipSmTxtActive]} numberOfLines={1}>{l.order_index}. {l.title_ar?.substring(0, 20)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <SourcePicker selected={lessonBlocksForm.source_ids} onToggle={(id) => setLessonBlocksForm({ ...lessonBlocksForm, source_ids: toggleSourceId(lessonBlocksForm.source_ids, id) })} />
            <Btn title="توليد كتل الدرس" onPress={genLessonBlocks} loading={loading === 'lesson'} color={Colors.primaryLight} icon="sparkles"
              disabled={!lessonBlocksForm.lesson_id || lessonBlocksForm.source_ids.size === 0} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>توليد أسئلة</Text>
            <Text style={s.listSub}>يولد أسئلة اختيار من متعدد بتوزيع صعوبة محدد</Text>
            {lessons.length > 0 && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>ربط بدرس (اختياري)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 4 }}>
                  <Pressable style={[s.chipSm, qForm.lesson_id === null && s.chipSmActive]}
                    onPress={() => setQForm({ ...qForm, lesson_id: null })}>
                    <Text style={[s.chipSmTxt, qForm.lesson_id === null && s.chipSmTxtActive]}>بدون</Text>
                  </Pressable>
                  {lessons.map(l => (
                    <Pressable key={l.id} style={[s.chipSm, qForm.lesson_id === l.id && s.chipSmActive]}
                      onPress={() => setQForm({ ...qForm, lesson_id: l.id })}>
                      <Text style={[s.chipSmTxt, qForm.lesson_id === l.id && s.chipSmTxtActive]} numberOfLines={1}>{l.order_index}. {l.title_ar?.substring(0, 20)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <SourcePicker selected={qForm.source_ids} onToggle={(id) => setQForm({ ...qForm, source_ids: toggleSourceId(qForm.source_ids, id) })} />
            <Field label="عدد الأسئلة" value={qForm.count} onChangeText={(v: string) => setQForm({ ...qForm, count: v })} keyboardType="numeric" />
            <View style={s.rowFields}>
              <View style={{ flex: 1 }}><Field label="سهل %" value={qForm.easy} onChangeText={(v: string) => setQForm({ ...qForm, easy: v })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="متوسط %" value={qForm.medium} onChangeText={(v: string) => setQForm({ ...qForm, medium: v })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="صعب %" value={qForm.hard} onChangeText={(v: string) => setQForm({ ...qForm, hard: v })} keyboardType="numeric" /></View>
            </View>
            <Btn title="توليد الأسئلة" onPress={genQuestions} loading={loading === 'questions'} color={Colors.primaryLight} icon="sparkles"
              disabled={qForm.source_ids.size === 0} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>توليد نسخة امتحان بديلة</Text>
            <Text style={s.listSub}>ينشئ نسخة جديدة من امتحان موجود بنفس الهيكل والصعوبة</Text>
            <View style={s.field}>
              <Text style={s.fieldLabel}>اختر الامتحان</Text>
              {exams.length === 0 && <Text style={s.empty}>لا توجد امتحانات. أنشئ امتحاناً أولاً.</Text>}
              {exams.map(e => (
                <Pressable key={e.id} style={[s.sourceCheckItem, examForm.exam_id === e.id && s.sourceCheckItemSelected]}
                  onPress={() => setExamForm({ ...examForm, exam_id: e.id })}>
                  <Ionicons name={examForm.exam_id === e.id ? 'radio-button-on' : 'radio-button-off'} size={20}
                    color={examForm.exam_id === e.id ? Colors.primary : Colors.textSecondary} />
                  <Text style={s.sourceCheckTxt}>{e.title_ar} ({e.year || '-'})</Text>
                </Pressable>
              ))}
            </View>
            <SourcePicker selected={examForm.source_ids} onToggle={(id) => setExamForm({ ...examForm, source_ids: toggleSourceId(examForm.source_ids, id) })} />
            <Btn title="توليد النسخة البديلة" onPress={genExamVariant} loading={loading === 'exam'} color={Colors.primaryLight} icon="sparkles"
              disabled={!examForm.exam_id || examForm.source_ids.size === 0} />
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'right', marginRight: 10 },
  loginBox: { flex: 1, padding: 24, justifyContent: 'center' },
  loginTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 24 },
  tokenInput: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border, textAlign: 'center' },
  tabBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 52 },
  tab: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, gap: 4 },
  tabActive: { backgroundColor: Colors.primary },
  tabTxt: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  tabTxtActive: { color: '#fff' },
  content: { flex: 1, padding: 12 },
  secHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  secTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.primary, textAlign: 'right', marginBottom: 10 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary, textAlign: 'right', marginBottom: 4 },
  input: { backgroundColor: Colors.background, borderRadius: 8, padding: 10, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border, textAlign: 'right' },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' as const },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  btnRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dis: { opacity: 0.5 },
  btnGroup: { flexDirection: 'row-reverse', gap: 8, marginTop: 4 },
  msg: { fontSize: 13, textAlign: 'center', marginVertical: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  msgErr: { color: Colors.danger, backgroundColor: Colors.danger + '15' },
  msgOk: { color: Colors.success, backgroundColor: Colors.success + '15' },
  listItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  listTitle: { fontSize: 14, fontWeight: '500', color: Colors.text, textAlign: 'right' },
  listSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  listActions: { flexDirection: 'row-reverse', gap: 12, marginLeft: 8 },
  pickerRow: { marginBottom: 10, maxHeight: 44 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: 13, color: Colors.text },
  chipTxtActive: { color: '#fff' },
  chipSm: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  chipSmActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipSmTxt: { fontSize: 12, color: Colors.text },
  chipSmTxtActive: { color: '#fff' },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statusRow: { flexDirection: 'row-reverse', gap: 8 },
  rowFields: { flexDirection: 'row-reverse', gap: 8 },
  colorDot: { width: 8, height: 32, borderRadius: 4, marginLeft: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
  diffDot: { width: 6, height: 24, borderRadius: 3, marginLeft: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: 'center' },
  badgeTxt: { fontSize: 12, color: '#fff', fontWeight: '700' },
  empty: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginVertical: 16, fontStyle: 'italic' },
  blocksSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  blocksHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  blocksSectionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  blockEditCard: { backgroundColor: Colors.primaryLight + '10', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.primaryLight + '30' },
  blockEditTitle: { fontSize: 13, fontWeight: '600', color: Colors.primaryLight, textAlign: 'right', marginBottom: 8 },
  blockItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  blockItemEditing: { borderColor: Colors.primaryLight, backgroundColor: Colors.primaryLight + '08' },
  blockItemLeft: { gap: 2, marginLeft: 8 },
  blockItemHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  blockTypeLabel: { fontSize: 12, fontWeight: '600', color: Colors.accent },
  blockTitle: { fontSize: 12, color: Colors.text },
  blockPreview: { fontSize: 11, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  optionsCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 10 },
  optionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionRadio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  optionRadioActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  questionCheckItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, backgroundColor: Colors.background },
  questionCheckItemSelected: { borderColor: Colors.success, backgroundColor: Colors.success + '08' },
  sourceCheckItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4, backgroundColor: Colors.background },
  sourceCheckItemSelected: { backgroundColor: Colors.success + '10' },
  sourceCheckTxt: { fontSize: 13, color: Colors.text, flex: 1, textAlign: 'right' },
});
