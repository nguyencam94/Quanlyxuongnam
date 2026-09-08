/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingCart, 
  Users, 
  CalendarDays, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  LogOut, 
  LogIn,
  CheckCircle2,
  Clock,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from './firebase';
import { 
  subscribeTransactions, 
  subscribeOrders, 
  subscribeWorkers, 
  subscribePlans,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addOrder,
  addWorker,
  addPlan,
  updateOrderStatus,
  updatePlan,
  extendPlan,
  deletePlan
} from './services/firestore';
import { cn, formatCurrency } from './lib/utils';
import { 
  format, 
  formatDistanceToNow, 
  isPast,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Edit2, 
  Trash2, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Check, 
  ListTodo, 
  PlusCircle, 
  Trash, 
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  Wallet,
  Layers,
  CalendarClock,
  RotateCcw,
  Sparkles,
  Filter,
  SlidersHorizontal,
  Search
} from 'lucide-react';
import { PlanBudgetManager } from './components/PlanBudgetManager';
import { ExtendPlanModal } from './components/ExtendPlanModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

// --- Types ---
type Tab = 'dashboard' | 'transactions' | 'orders' | 'workers' | 'plans';

// --- Components ---

const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      if (isPast(targetDate)) {
        setTimeLeft('Đã quá hạn');
        return;
      }
      setTimeLeft(formatDistanceToNow(targetDate, { addSuffix: true, locale: vi }));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
      timeLeft === 'Đã quá hạn' ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
    )}>
      <Clock className="w-3 h-3" />
      {timeLeft}
    </div>
  );
};

const Plans = ({ plans }: { plans: any[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
    status: 'todo',
    subtasks: [] as any[]
  });
  const [newSubtask, setNewSubtask] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [inlineSubtask, setInlineSubtask] = useState('');
  const [planToExtend, setPlanToExtend] = useState<any | null>(null);

  const getPlanDate = (plan: any): Date | null => {
    if (!plan?.startDate) return null;
    return plan.startDate?.toDate ? plan.startDate.toDate() : new Date(plan.startDate);
  };

  const openAddModalForDate = (date: Date) => {
    setEditingPlan(null);
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = new Date();
    const timeStr = isSameDay(date, now) ? format(now, 'HH:mm') : '09:00';
    setFormData({ 
      title: '', 
      description: '', 
      startDate: `${dateStr}T${timeStr}`, 
      status: 'todo',
      subtasks: []
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    const dateStr = format(selectedDate || new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const timeStr = isSameDay(selectedDate || now, now) ? format(now, 'HH:mm') : '09:00';
    setFormData({ 
      title: '', 
      description: '', 
      startDate: `${dateStr}T${timeStr}`, 
      status: 'todo',
      subtasks: []
    });
  };

  useEffect(() => {
    if (editingPlan) {
      setFormData({
        title: editingPlan.title,
        description: editingPlan.description || '',
        startDate: format(editingPlan.startDate.toDate(), "yyyy-MM-dd'T'HH:mm"),
        status: editingPlan.status,
        subtasks: editingPlan.subtasks || []
      });
      setShowModal(true);
    }
  }, [editingPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      await updatePlan(editingPlan.id, formData);
    } else {
      await addPlan(formData);
    }
    closeModal();
  };

  const handleDelete = async () => {
    if (planToDelete) {
      await deletePlan(planToDelete);
      if (selectedPlanId === planToDelete) {
        setSelectedPlanId(null);
      }
      setPlanToDelete(null);
    }
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSubtask,
      completed: false
    };
    setFormData({ ...formData, subtasks: [...formData.subtasks, subtask] });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    const updatedSubtasks = formData.subtasks.map(st => 
      st.id === id ? { ...st, completed: !st.completed } : st
    );
    setFormData({ ...formData, subtasks: updatedSubtasks });
  };

  const removeSubtask = (id: string) => {
    setFormData({ ...formData, subtasks: formData.subtasks.filter(st => st.id !== id) });
  };

  const togglePlanStatus = async (plan: any) => {
    const newStatus = plan.status === 'done' ? 'todo' : 'done';
    await updatePlan(plan.id, { status: newStatus });
  };

  const toggleSubtaskInList = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.map((st: any) => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    await updatePlan(plan.id, { subtasks: updatedSubtasks });
  };

  // Inline Handlers for Detail View
  const handleAddSubtaskDetail = async (plan: any, title: string) => {
    const subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: title,
      completed: false
    };
    const updatedSubtasks = [...(plan.subtasks || []), subtask];
    await updatePlan(plan.id, { subtasks: updatedSubtasks });
  };

  const handleToggleSubtaskDetail = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.map((st: any) => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    await updatePlan(plan.id, { subtasks: updatedSubtasks });
  };

  const handleRemoveSubtaskDetail = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.filter((st: any) => st.id !== subtaskId);
    await updatePlan(plan.id, { subtasks: updatedSubtasks });
  };

  const handleTogglePlanStatusDetail = async (plan: any) => {
    const newStatus = plan.status === 'done' ? 'todo' : 'done';
    await updatePlan(plan.id, { status: newStatus });
  };

  // Find active selected plan
  const activePlan = plans.find(p => p.id === selectedPlanId);

  // Render Plan Details View if activePlan exists
  if (activePlan) {
    const totalSubtasks = activePlan.subtasks?.length || 0;
    const completedSubtasks = activePlan.subtasks?.filter((st: any) => st.completed).length || 0;
    const completionPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
    const activePlanDate = getPlanDate(activePlan);
    const isActiveOverdue = activePlanDate ? (isPast(activePlanDate) && activePlan.status !== 'done') : false;
    const extensionCount = activePlan.extensionCount || (activePlan.extensions?.length || 0);

    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
        {/* Back & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:bg-transparent md:p-0 md:border-none md:shadow-none">
          <button 
            onClick={() => setSelectedPlanId(null)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-bold transition-all px-2.5 py-1.5 hover:bg-slate-50 md:hover:bg-slate-100 rounded-xl text-xs md:text-sm self-start"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span>Quay lại danh sách</span>
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPlanToExtend(activePlan)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 md:px-4 md:py-2 bg-amber-50 text-amber-800 font-bold hover:bg-amber-100 rounded-xl transition-all text-xs md:text-sm border border-amber-200"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              <span>Gia hạn {extensionCount > 0 ? `(Lần ${extensionCount + 1})` : ''}</span>
            </button>
            <button 
              onClick={() => setEditingPlan(activePlan)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 rounded-xl transition-all text-xs md:text-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Chỉnh sửa</span>
            </button>
            <button 
              onClick={() => setPlanToDelete(activePlan.id)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 font-semibold hover:bg-red-100 rounded-xl transition-all text-xs md:text-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa kế hoạch</span>
            </button>
          </div>
        </div>

        {/* Notice: Đã gia hạn lần 1, lần 2... */}
        {extensionCount > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl shrink-0 mt-0.5 shadow-xs">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm md:text-base text-amber-950">
                    Thông báo: Mục tiêu đã được gia hạn lần {extensionCount}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900 uppercase tracking-wide border border-amber-300">
                    Đã gia hạn lần {extensionCount}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-amber-800/90 mt-1 leading-relaxed">
                  {activePlan.originalStartDate && (
                    <span>Hạn ban đầu: <strong className="font-bold">{format(activePlan.originalStartDate.toDate ? activePlan.originalStartDate.toDate() : new Date(activePlan.originalStartDate), 'HH:mm - dd/MM/yyyy')}</strong> &rarr; </span>
                  )}
                  Hạn hiện tại: <strong className="font-bold">{activePlanDate ? format(activePlanDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setPlanToExtend(activePlan)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <CalendarClock className="w-4 h-4" />
              <span>Gia hạn tiếp (Lần {extensionCount + 1})</span>
            </button>
          </div>
        )}

        {/* Overdue Task Alert Banner */}
        {isActiveOverdue && (
          <div className="bg-red-50/90 border border-red-200 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-2xl shrink-0 mt-0.5 shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm md:text-base text-red-900">
                  Mục tiêu này đã quá hạn hoàn thành!
                </h4>
                <p className="text-xs md:text-sm text-red-700 mt-0.5">
                  {extensionCount > 0 
                    ? `Công việc đã quá hạn sau ${extensionCount} lần gia hạn. Bạn có thể gia hạn sang ngày khác để dời thời hạn.` 
                    : 'Đã quá thời hạn thực hiện mục tiêu. Hãy gia hạn công việc sang một ngày khác để tiếp tục theo dõi tiến độ.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPlanToExtend(activePlan)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-md shadow-red-200 flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <CalendarClock className="w-4 h-4" />
              <span>Gia hạn công việc ngay</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Left Column: Detail card */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-8 space-y-4 md:space-y-6">
              <div className="flex items-start gap-3 md:gap-4">
                <button 
                  onClick={() => handleTogglePlanStatusDetail(activePlan)}
                  className={cn(
                    "mt-0.5 p-0.5 rounded-md transition-colors",
                    activePlan.status === 'done' ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500"
                  )}
                >
                  {activePlan.status === 'done' ? <CheckSquare className="w-6 h-6 md:w-7 md:h-7" /> : <Square className="w-6 h-6 md:w-7 md:h-7" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={cn(
                      "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full",
                      activePlan.status === 'done' ? "bg-emerald-50 text-emerald-700" :
                      activePlan.status === 'in-progress' ? "bg-blue-50 text-blue-700" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {activePlan.status === 'done' ? 'Hoàn thành' : activePlan.status === 'in-progress' ? 'Đang làm' : 'Chờ làm'}
                    </span>
                    {activePlanDate && <CountdownTimer targetDate={activePlanDate} />}
                    {extensionCount > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Đã gia hạn lần {extensionCount}
                      </span>
                    )}
                  </div>
                  <h1 className={cn(
                    "text-xl md:text-2xl font-black text-slate-900 leading-snug break-words",
                    activePlan.status === 'done' && "line-through text-slate-400"
                  )}>
                    {activePlan.title}
                  </h1>
                </div>
              </div>

              {/* Description Section */}
              <div className="border-t border-slate-50 pt-4 md:pt-6">
                <h3 className="text-xs md:text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500" />
                  <span>Mô tả chi tiết</span>
                </h3>
                <div className="bg-slate-50/50 rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100/50 min-h-[80px]">
                  <p className="text-sm md:text-base text-slate-700 whitespace-pre-line leading-relaxed">
                    {activePlan.description || "Không có mô tả chi tiết."}
                  </p>
                </div>
              </div>

              {/* Subtasks Progress Bar */}
              {totalSubtasks > 0 && (
                <div className="border-t border-slate-50 pt-4 md:pt-6 space-y-1.5">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="font-bold text-slate-700">Tiến độ hạng mục con</span>
                    <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      {completedSubtasks}/{totalSubtasks} ({completionPercentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 md:h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Inline Subtasks List Section */}
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-8 space-y-4 md:space-y-6">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 mb-0.5">Các hạng mục con</h3>
                <p className="text-slate-500 text-xs md:text-sm">Quản lý và cập nhật tiến độ các hạng mục nhỏ trực tiếp</p>
              </div>

              {/* Quick add subtask form */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!inlineSubtask.trim()) return;
                  await handleAddSubtaskDetail(activePlan, inlineSubtask);
                  setInlineSubtask('');
                }}
                className="flex gap-2"
              >
                <input 
                  type="text"
                  value={inlineSubtask}
                  onChange={(e) => setInlineSubtask(e.target.value)}
                  placeholder="Thêm hạng mục con mới..."
                  className="flex-1 px-3 py-2 md:px-4 md:py-3 rounded-xl border border-slate-200 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <button 
                  type="submit"
                  className="px-4 py-2 md:px-5 md:py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-1 text-xs md:text-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm
                </button>
              </form>

              {/* List of subtasks */}
              <div className="space-y-1.5">
                {activePlan.subtasks && activePlan.subtasks.length > 0 ? (
                  activePlan.subtasks.map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-all group">
                      <div className="flex items-center gap-2.5">
                        <button 
                          onClick={() => handleToggleSubtaskDetail(activePlan, st.id)}
                          className={cn(
                            "transition-colors p-0.5 rounded",
                            st.completed ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500"
                          )}
                        >
                          {st.completed ? <CheckSquare className="w-4.5 h-4.5 md:w-5 md:h-5" /> : <Square className="w-4.5 h-4.5 md:w-5 md:h-5" />}
                        </button>
                        <span className={cn(
                          "text-xs md:text-sm font-semibold transition-all break-all pr-2",
                          st.completed ? "text-slate-400 line-through" : "text-slate-700"
                        )}>
                          {st.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemoveSubtaskDetail(activePlan, st.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 md:py-8 bg-slate-50/30 rounded-xl md:rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-xs md:text-sm">Chưa có hạng mục con nào. Hãy thêm ở trên.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Information panel */}
          <div className="space-y-4 md:space-y-6">
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-3 md:space-y-4">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Thông tin hạn chót</h3>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500">Hạn hoàn thành:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {activePlanDate ? format(activePlanDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500">Thời gian còn lại:</span>
                  {activePlanDate && <CountdownTimer targetDate={activePlanDate} />}
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500">Số lần gia hạn:</span>
                  {extensionCount > 0 ? (
                    <span className="font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-xs flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-amber-600" />
                      Đã gia hạn lần {extensionCount}
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-400">Chưa gia hạn</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2">
                  <span className="text-slate-500">Trạng thái:</span>
                  <select 
                    value={activePlan.status}
                    onChange={async (e) => {
                      await updatePlan(activePlan.id, { status: e.target.value });
                    }}
                    className="text-xs font-bold bg-slate-50 border-none rounded-lg px-2.5 py-1.5 focus:ring-0 cursor-pointer text-slate-700"
                  >
                    <option value="todo">Chờ làm</option>
                    <option value="in-progress">Đang làm</option>
                    <option value="done">Hoàn thành</option>
                  </select>
                </div>

                <button
                  onClick={() => setPlanToExtend(activePlan)}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs md:text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-xs shadow-amber-200 active:scale-[0.99]"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span>{extensionCount > 0 ? `Gia hạn tiếp (Lần ${extensionCount + 1})` : 'Gia hạn thời gian công việc'}</span>
                </button>
              </div>
            </div>

            {/* Extension History Card */}
            {activePlan.extensions && activePlan.extensions.length > 0 && (
              <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Lịch sử gia hạn ({activePlan.extensions.length})</span>
                  </h3>
                  <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Đã gia hạn lần {extensionCount}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activePlan.extensions.map((ext: any, idx: number) => {
                    const extDate = ext.extendedAt ? new Date(ext.extendedAt) : null;
                    const prevDate = ext.previousDate ? new Date(ext.previousDate) : null;
                    const nextDate = ext.newDate ? new Date(ext.newDate) : null;
                    return (
                      <div 
                        key={ext.id || idx}
                        className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                            Gia hạn lần {ext.extensionNumber || (idx + 1)}
                          </span>
                          {extDate && (
                            <span className="text-[10px] text-slate-400">
                              {format(extDate, 'dd/MM/yyyy HH:mm')}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 text-[11px] flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-slate-400">
                            {prevDate ? format(prevDate, 'dd/MM/yyyy HH:mm') : 'Hạn cũ'}
                          </span>
                          <span className="text-slate-400 font-bold">&rarr;</span>
                          <span className="font-bold text-amber-800">
                            {nextDate ? format(nextDate, 'dd/MM/yyyy HH:mm') : 'Hạn mới'}
                          </span>
                        </div>
                        {ext.reason && (
                          <p className="text-[11px] text-slate-600 italic bg-white/70 p-1.5 rounded border border-slate-100">
                            "{ext.reason}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal chỉnh sửa vẫn dùng chung */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingPlan ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ mới'}
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tiêu đề</label>
                      <input 
                        type="text" 
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mô tả chi tiết</label>
                      <textarea 
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Thời gian hoàn thành</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Hạng mục con (Subtasks)</label>
                    <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        placeholder="Thêm hạng mục nhỏ..."
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                      />
                      <button 
                        type="button"
                        onClick={addSubtask}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {formData.subtasks.map((st) => (
                        <div key={st.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              onClick={() => toggleSubtask(st.id)}
                              className={cn(
                                "transition-colors",
                                st.completed ? "text-emerald-500" : "text-slate-300"
                              )}
                            >
                              {st.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                            <span className={cn(
                              "text-sm font-medium",
                              st.completed ? "text-slate-400 line-through" : "text-slate-700"
                            )}>{st.title}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeSubtask(st.id)}
                            className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      {editingPlan ? 'Cập nhật' : 'Lưu nhiệm vụ'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal xác nhận xóa */}
        <AnimatePresence>
          {planToDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
                <p className="text-slate-500 mb-8">Bạn có chắc chắn muốn xóa nhiệm vụ này? Hành động này không thể hoàn tác.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setPlanToDelete(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    Xóa ngay
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal gia hạn công việc */}
        <ExtendPlanModal 
          plan={planToExtend} 
          isOpen={!!planToExtend} 
          onClose={() => setPlanToExtend(null)} 
        />
      </div>
    );
  }

  // Calendar calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDateGrid = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDateGrid = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDateGrid, end: endDateGrid });

  const getPlansForDate = (date: Date) => {
    return plans.filter(p => {
      const pDate = getPlanDate(p);
      return pDate ? isSameDay(pDate, date) : false;
    });
  };

  const selectedDayPlans = getPlansForDate(selectedDate);
  const currentMonthPlans = plans.filter(p => {
    const pDate = getPlanDate(p);
    return pDate ? isSameMonth(pDate, currentMonth) : false;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Kế hoạch làm việc</h2>
          <p className="text-slate-500 text-xs md:text-sm">Lên lịch theo dõi nhiệm vụ theo cuốn lịch hoặc danh sách</p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle Switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all",
                viewMode === 'calendar' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Theo lịch</span>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all",
                viewMode === 'list' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List className="w-4 h-4" />
              <span>Danh sách</span>
            </button>
          </div>

          <button 
            onClick={() => openAddModalForDate(selectedDate)}
            className="flex items-center gap-1 px-3.5 py-2 md:px-5 md:py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 shrink-0"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span>Thêm nhiệm vụ</span>
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-4 md:space-y-6">
          {/* Calendar Book Component */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-6">
            {/* Calendar Navigation & Month Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600 active:scale-95"
                  title="Tháng trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg md:text-xl font-black text-slate-900 capitalize min-w-[180px] text-center">
                  {format(currentMonth, 'MMMM yyyy', { locale: vi })}
                </h3>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-600 active:scale-95"
                  title="Tháng sau"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(today);
                    setSelectedDate(today);
                  }}
                  className="ml-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all active:scale-95"
                >
                  Hôm nay
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100">
                    {currentMonthPlans.length} kế hoạch
                  </span>
                  <span>trong tháng</span>
                </div>
                <div className="hidden sm:flex items-center gap-3 border-l border-slate-200 pl-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Hoàn thành</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>Chờ thực hiện</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Weekday Names Header */}
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((dayName, idx) => (
                <div 
                  key={dayName} 
                  className={cn(
                    "text-center py-1.5 text-[11px] md:text-xs font-bold uppercase tracking-wider",
                    idx >= 5 ? "text-amber-600" : "text-slate-500"
                  )}
                >
                  <span className="hidden md:inline">{dayName}</span>
                  <span className="md:hidden">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][idx]}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dayPlans = getPlansForDate(day);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-[64px] sm:min-h-[85px] md:min-h-[105px] rounded-xl md:rounded-2xl border p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-all duration-200 group relative select-none",
                      isSelected 
                        ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-sm z-10" 
                        : isCurrentMonth 
                          ? "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/70 shadow-xs" 
                          : "bg-slate-50/40 border-slate-100 text-slate-300 opacity-60 hover:opacity-100 hover:bg-slate-50"
                    )}
                  >
                    {/* Top Row: Date number & Quick Add button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex items-center justify-center text-xs md:text-sm font-black rounded-full transition-colors",
                          isTodayDate 
                            ? "w-6 h-6 md:w-7 md:h-7 bg-indigo-600 text-white shadow-sm" 
                            : isSelected 
                              ? "w-6 h-6 md:w-7 md:h-7 bg-indigo-200 text-indigo-900" 
                              : isCurrentMonth 
                                ? "text-slate-700 group-hover:text-indigo-600" 
                                : "text-slate-300"
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Quick Add Button on Cell Hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddModalForDate(day);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all hidden sm:block"
                        title={`Thêm nhiệm vụ ngày ${format(day, 'dd/MM/yyyy')}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle / Bottom: Task Previews or Indicator Dots */}
                    <div>
                      {/* Mobile View: Dots */}
                      <div className="flex sm:hidden items-center justify-center gap-1 mt-1">
                        {dayPlans.slice(0, 3).map((p, idx) => (
                          <span 
                            key={idx} 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              p.status === 'done' ? "bg-emerald-500" : "bg-indigo-600"
                            )} 
                          />
                        ))}
                        {dayPlans.length > 3 && (
                          <span className="text-[9px] font-bold text-slate-400">+{dayPlans.length - 3}</span>
                        )}
                      </div>

                      {/* Desktop / Tablet View: Mini Task Badges */}
                      <div className="hidden sm:flex flex-col gap-1 mt-1 w-full overflow-hidden">
                        {dayPlans.slice(0, 2).map((p) => (
                          <div
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlanId(p.id);
                            }}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate font-medium border text-left transition-all",
                              p.status === 'done'
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/70 line-through opacity-75"
                                : "bg-indigo-50 text-indigo-800 border-indigo-100 hover:bg-indigo-100"
                            )}
                            title={p.title}
                          >
                            {p.title}
                          </div>
                        ))}
                        {dayPlans.length > 2 && (
                          <div className="text-[9px] md:text-[10px] font-bold text-indigo-600 pl-1">
                            +{dayPlans.length - 2} việc nữa
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Agenda / Task List */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center text-indigo-600 font-bold shrink-0">
                  <span className="text-[10px] uppercase leading-none font-black">{format(selectedDate, 'MMM', { locale: vi })}</span>
                  <span className="text-lg leading-none font-black mt-0.5">{format(selectedDate, 'dd')}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-900">
                      Nhiệm vụ {isToday(selectedDate) ? 'Hôm nay' : format(selectedDate, 'EEEE, dd/MM/yyyy', { locale: vi })}
                    </h3>
                    {isToday(selectedDate) && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-full">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedDayPlans.length > 0 
                      ? `${selectedDayPlans.length} nhiệm vụ (${selectedDayPlans.filter(p => p.status === 'done').length} đã hoàn thành)`
                      : 'Chưa có nhiệm vụ nào được lên lịch trong ngày này'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openAddModalForDate(selectedDate)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm nhiệm vụ ngày {format(selectedDate, 'dd/MM')}</span>
              </button>
            </div>

            {/* List of plans for the selected date */}
            <div className="grid grid-cols-1 gap-3">
              {selectedDayPlans.map((plan) => {
                const planDate = getPlanDate(plan);
                return (
                  <motion.div 
                    layout
                    key={plan.id} 
                    className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-xs hover:border-slate-200 hover:shadow-sm transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-3.5 md:p-4">
                      <div className="flex items-start gap-3 md:gap-4">
                        <button 
                          onClick={() => togglePlanStatus(plan)}
                          className={cn(
                            "mt-0.5 p-0.5 rounded-md transition-colors shrink-0",
                            plan.status === 'done' ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500"
                          )}
                        >
                          {plan.status === 'done' ? <CheckSquare className="w-5 h-5 md:w-6 md:h-6" /> : <Square className="w-5 h-5 md:w-6 md:h-6" />}
                        </button>
                        
                        <div 
                          onClick={() => setSelectedPlanId(plan.id)}
                          className="flex-1 cursor-pointer min-w-0"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <h4 className={cn(
                                  "font-bold text-sm md:text-base transition-all hover:text-indigo-600 truncate",
                                  plan.status === 'done' ? "text-slate-400 line-through" : "text-slate-900"
                                )}>
                                  {plan.title}
                                </h4>
                                {plan.extensionCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5 shrink-0">
                                    <RotateCcw className="w-2.5 h-2.5 text-amber-600" />
                                    Gia hạn lần {plan.extensionCount}
                                  </span>
                                )}
                              </div>
                              {plan.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{plan.description}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between sm:justify-start gap-2 mt-1 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                              {planDate && <CountdownTimer targetDate={planDate} />}
                              {planDate && isPast(planDate) && plan.status !== 'done' && (
                                <button 
                                  onClick={() => setPlanToExtend(plan)}
                                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-all shrink-0 border border-amber-200"
                                  title="Gia hạn thời gian công việc"
                                >
                                  <CalendarClock className="w-3 h-3 text-amber-600" />
                                  <span>Gia hạn</span>
                                </button>
                              )}
                              <div className="flex items-center gap-0.5">
                                <button 
                                  onClick={() => setPlanToExtend(plan)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                  title="Gia hạn công việc"
                                >
                                  <CalendarClock className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setEditingPlan(plan)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setPlanToDelete(plan.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] md:text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {planDate ? format(planDate, 'HH:mm') : 'Cả ngày'}
                              </span>
                              {plan.subtasks?.length > 0 && (
                                <div className="font-bold text-indigo-600 flex items-center gap-1">
                                  <ListTodo className="w-3 h-3" />
                                  <span>{plan.subtasks.filter((st: any) => st.completed).length}/{plan.subtasks.length} hạng mục con</span>
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-indigo-500 group-hover:translate-x-1 transition-all flex items-center gap-0.5 shrink-0">
                              Chi tiết &rarr;
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {selectedDayPlans.length === 0 && (
                <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-xs border border-slate-100 flex items-center justify-center mx-auto mb-3 text-indigo-500">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Chưa có nhiệm vụ nào cho ngày {format(selectedDate, 'dd/MM/yyyy')}</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Bạn có thể lên lịch tưới nấm, cấy giống, thu hoạch hoặc xuất hàng cho ngày này</p>
                  <button
                    onClick={() => openAddModalForDate(selectedDate)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-indigo-100"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lên lịch nhiệm vụ ngay</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-3 md:gap-4">
          {plans.map((plan) => {
            const planDate = getPlanDate(plan);
            return (
              <motion.div 
                layout
                key={plan.id} 
                className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-300"
              >
                <div className="p-4 md:p-6">
                  <div className="flex items-start gap-3 md:gap-4">
                    <button 
                      onClick={() => togglePlanStatus(plan)}
                      className={cn(
                        "mt-0.5 p-0.5 rounded-md transition-colors shrink-0",
                        plan.status === 'done' ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500"
                      )}
                    >
                      {plan.status === 'done' ? <CheckSquare className="w-5 h-5 md:w-6 md:h-6" /> : <Square className="w-5 h-5 md:w-6 md:h-6" />}
                    </button>
                    
                    <div 
                      onClick={() => setSelectedPlanId(plan.id)}
                      className="flex-1 cursor-pointer min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className={cn(
                              "font-bold text-base md:text-lg transition-all hover:text-indigo-600 truncate",
                              plan.status === 'done' ? "text-slate-400 line-through" : "text-slate-900"
                            )}>
                              {plan.title}
                            </h4>
                            {plan.extensionCount > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shrink-0">
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                Đã gia hạn lần {plan.extensionCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs md:text-sm text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-start gap-2 mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                          {planDate && <CountdownTimer targetDate={planDate} />}
                          {planDate && isPast(planDate) && plan.status !== 'done' && (
                            <button 
                              onClick={() => setPlanToExtend(plan)}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 transition-all shrink-0 border border-amber-200"
                              title="Gia hạn thời gian công việc"
                            >
                              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Gia hạn</span>
                            </button>
                          )}
                          <div className="flex items-center gap-0.5">
                            <button 
                              onClick={() => setPlanToExtend(plan)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Gia hạn công việc"
                            >
                              <CalendarClock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingPlan(plan)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button 
                              onClick={() => setPlanToDelete(plan.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] md:text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {planDate ? format(planDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}
                          </span>
                          {plan.subtasks?.length > 0 && (
                            <div className="font-bold text-indigo-600 flex items-center gap-1">
                              <ListTodo className="w-3 h-3" />
                              <span>{plan.subtasks.filter((st: any) => st.completed).length}/{plan.subtasks.length} hạng mục con</span>
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-indigo-500 group-hover:translate-x-1 transition-all flex items-center gap-0.5 shrink-0">
                          Chi tiết &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {plans.length === 0 && (
            <div className="bg-white p-8 md:p-12 rounded-xl md:rounded-2xl border border-dashed border-slate-200 text-center">
              <CalendarDays className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Chưa có kế hoạch nào được tạo</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingPlan ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ mới'}
                  </h3>
                  <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {formData.startDate 
                        ? `Lên lịch ngày: ${format(new Date(formData.startDate), 'dd/MM/yyyy')}`
                        : 'Lên lịch công việc'}
                    </span>
                  </p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tiêu đề</label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mô tả chi tiết</label>
                    <textarea 
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Thời gian hoàn thành</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Hạng mục con (Subtasks)</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Thêm hạng mục nhỏ..."
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                    />
                    <button 
                      type="button"
                      onClick={addSubtask}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {formData.subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => toggleSubtask(st.id)}
                            className={cn(
                              "transition-colors",
                              st.completed ? "text-emerald-500" : "text-slate-300"
                            )}
                          >
                            {st.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                          <span className={cn(
                            "text-sm font-medium",
                            st.completed ? "text-slate-400 line-through" : "text-slate-700"
                          )}>{st.title}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeSubtask(st.id)}
                          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingPlan ? 'Cập nhật' : 'Lưu nhiệm vụ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {planToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Xác nhận xóa</h3>
              <p className="text-slate-500 mb-8">Bạn có chắc chắn muốn xóa nhiệm vụ này? Hành động này không thể hoàn tác.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setPlanToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Xóa ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal gia hạn công việc */}
      <ExtendPlanModal 
        plan={planToExtend} 
        isOpen={!!planToExtend} 
        onClose={() => setPlanToExtend(null)} 
      />
    </div>
  );
};

const MushroomIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path 
      d="M12 3C7.5 3 4 6.5 4 11c0 .55.45 1 1 1h14c.55 0 1-.45 1-1 0-4.5-3.5-8-8-8z" 
      className="fill-emerald-500 stroke-emerald-600" 
    />
    <path 
      d="M10 12v6a2 2 0 0 0 4 0v-6" 
      className="stroke-emerald-600" 
      strokeWidth="2.5"
    />
    <circle cx="9" cy="7.5" r="1" className="fill-white stroke-none" />
    <circle cx="15" cy="8.5" r="1" className="fill-white stroke-none" />
    <circle cx="12" cy="6" r="1" className="fill-white stroke-none" />
  </svg>
);

const Sidebar = ({ activeTab, setActiveTab, user }: { activeTab: Tab, setActiveTab: (tab: Tab) => void, user: User | null }) => {
  const menuItems = [
    { id: 'plans', label: 'Kế hoạch', icon: CalendarDays },
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'transactions', label: 'Thu chi', icon: Receipt },
    { id: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
    { id: 'workers', label: 'Nhân sự', icon: Users },
  ];

  return (
    <div className="hidden md:flex w-64 bg-white border-r border-slate-200 h-screen flex-col sticky top-0">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
          <img 
            src="/app-icon.png" 
            alt="Trại Nấm Michfarm" 
            className="w-9 h-9 rounded-xl shadow-xs shrink-0 object-cover border border-emerald-100" 
            referrerPolicy="no-referrer" 
          />
          <span className="tracking-tight text-emerald-800 font-extrabold text-lg">Trại Nấm Michfarm</span>
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              activeTab === item.id 
                ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-600" : "text-slate-400")} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-3">
        <div className="px-1">
          <PWAInstallButton />
        </div>
        {user ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
              <button 
                onClick={() => signOut(auth)}
                className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Đăng xuất
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <LogIn className="w-4 h-4" /> Đăng nhập
          </button>
        )}
      </div>
    </div>
  );
};

const Dashboard = ({ transactions, orders, workers, plans }: any) => {
  const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const chartData = [
    { name: 'Thu nhập', value: totalIncome, color: '#10b981' },
    { name: 'Chi phí', value: totalExpense, color: '#ef4444' },
  ];

  const stats = [
    { label: 'Số dư hiện tại', value: formatCurrency(balance), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Đơn hàng mới', value: orders.filter((o: any) => o.status === 'pending').length, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Nhân sự hoạt động', value: workers.filter((w: any) => w.status === 'active').length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Kế hoạch hôm nay', value: plans.length, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-5 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={stat.label} 
            className="bg-white p-3 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className={cn("p-2 md:p-3 rounded-lg md:rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-5 h-5 md:w-6 md:h-6", stat.color)} />
              </div>
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-slate-500 font-semibold truncate leading-none">{stat.label}</p>
              <h3 className="text-sm md:text-2xl font-black text-slate-900 mt-1.5 break-words leading-none">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6">Phân tích Thu Chi</h3>
          <div className="h-[200px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dx={-5} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 md:p-8 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6">Đơn hàng gần đây</h3>
          <div className="space-y-2 md:space-y-4">
            {orders.slice(0, 5).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs md:text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{order.customerName}</p>
                  <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">{formatCurrency(order.totalAmount)}</p>
                </div>
                <span className={cn(
                  "px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider shrink-0",
                  order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                  order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                  "bg-slate-200 text-slate-700"
                )}>
                  {order.status}
                </span>
              </div>
            ))}
            {orders.length === 0 && <p className="text-center text-slate-400 py-6 text-xs md:text-sm">Chưa có đơn hàng nào</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_CATEGORIES: Record<'income' | 'expense', string[]> = {
  income: [
    "Bán nấm sò",
    "Bán nấm bào ngư",
    "Bán phôi giống",
    "Bán nấm linh chi",
    "Bán lẻ",
    "Thu khác"
  ],
  expense: [
    "Mua phôi giống",
    "Nguyên vật liệu & mùn cưa",
    "Tiền điện nước",
    "Bao bì đóng gói",
    "Nhân công",
    "Vận chuyển",
    "Chi khác"
  ]
};

const Transactions = ({ transactions, plans = [] }: { transactions: any[]; plans?: any[] }) => {
  const [subTab, setSubTab] = useState<'actual' | 'budget'>('actual');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lưu trữ các hạng mục người dùng đã từng điền hoặc dùng vào LocalStorage
  const [customCategories, setCustomCategories] = useState<Record<'income' | 'expense', string[]>>(() => {
    try {
      const saved = localStorage.getItem('michfarm_custom_categories');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading custom categories:', e);
    }
    return { income: [], expense: [] };
  });

  // Danh sách các thẻ gợi ý người dùng đã chủ động bấm xóa (nếu có nhầm lẫn)
  const [deletedCategories, setDeletedCategories] = useState<Record<'income' | 'expense', string[]>>(() => {
    try {
      const saved = localStorage.getItem('michfarm_deleted_categories');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading deleted categories:', e);
    }
    return { income: [], expense: [] };
  });

  const [formData, setFormData] = useState({ 
    type: 'income', 
    amount: 0, 
    category: '', 
    description: '', 
    date: format(new Date(), 'yyyy-MM-dd'),
    planId: ''
  });

  // Hàm tự động lưu và đưa hạng mục vừa dùng lên đầu danh sách gợi ý
  const saveCategoryUsage = (type: 'income' | 'expense', newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;

    setCustomCategories(prev => {
      const currentList = prev[type] || [];
      const filtered = currentList.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
      const nextList = [trimmed, ...filtered].slice(0, 40);
      const nextState = { ...prev, [type]: nextList };
      try {
        localStorage.setItem('michfarm_custom_categories', JSON.stringify(nextState));
      } catch (e) {
        console.error('Error saving custom categories:', e);
      }
      return nextState;
    });

    // Nếu trước đó đã từng xóa, người dùng dùng lại thì khôi phục
    setDeletedCategories(prev => {
      const currentDeleted = prev[type] || [];
      if (currentDeleted.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
        const nextDeleted = currentDeleted.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
        const nextState = { ...prev, [type]: nextDeleted };
        try {
          localStorage.setItem('michfarm_deleted_categories', JSON.stringify(nextState));
        } catch (e) {}
        return nextState;
      }
      return prev;
    });
  };

  // Cho phép xóa thẻ gợi ý nếu người dùng gõ sai chính tả
  const removeCategorySuggestion = (type: 'income' | 'expense', catToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const lower = catToRemove.toLowerCase().trim();

    setCustomCategories(prev => {
      const filtered = (prev[type] || []).filter(c => c.toLowerCase() !== lower);
      const nextState = { ...prev, [type]: filtered };
      try {
        localStorage.setItem('michfarm_custom_categories', JSON.stringify(nextState));
      } catch (err) {}
      return nextState;
    });

    setDeletedCategories(prev => {
      const filtered = (prev[type] || []).filter(c => c.toLowerCase() !== lower);
      const nextState = { ...prev, [type]: [...filtered, lower] };
      try {
        localStorage.setItem('michfarm_deleted_categories', JSON.stringify(nextState));
      } catch (err) {}
      return nextState;
    });
  };

  // Tổng hợp gợi ý hạng mục:
  // 1. Những thẻ đã điền & lưu gần đây (ưu tiên đầu tiên)
  // 2. Toàn bộ các hạng mục đã từng dùng trong lịch sử Firestore của loại này
  // 3. Các hạng mục mẫu đặc thù của trại nấm
  const availableCategories = useMemo(() => {
    const currentType = (formData.type === 'expense' ? 'expense' : 'income') as 'income' | 'expense';
    const custom = customCategories[currentType] || [];
    const deleted = new Set((deletedCategories[currentType] || []).map(c => c.toLowerCase().trim()));
    const result: string[] = [];
    const seen = new Set<string>();

    // 1. Thẻ do người dùng điền hoặc lưu
    custom.forEach(cat => {
      const key = cat.toLowerCase().trim();
      if (key && !seen.has(key) && !deleted.has(key)) {
        seen.add(key);
        result.push(cat.trim());
      }
    });

    // 2. Thẻ đã từng xuất hiện trong toàn bộ lịch sử giao dịch Firestore
    transactions
      .filter(t => t.type === currentType && t.category && typeof t.category === 'string')
      .forEach(t => {
        const cat = t.category.trim();
        const key = cat.toLowerCase();
        if (key && !seen.has(key) && !deleted.has(key)) {
          seen.add(key);
          result.push(cat);
        }
      });

    // 3. Hạng mục mặc định mẫu
    const defaults = DEFAULT_CATEGORIES[currentType] || [];
    defaults.forEach(cat => {
      const key = cat.toLowerCase().trim();
      if (key && !seen.has(key) && !deleted.has(key)) {
        seen.add(key);
        result.push(cat);
      }
    });

    return result;
  }, [formData.type, customCategories, deletedCategories, transactions]);

  const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  // --- Bộ lọc danh sách thu chi (Theo hạng mục, thời gian, kế hoạch, loại giao dịch, tìm kiếm) ---
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Danh sách các hạng mục thực tế xuất hiện trong lịch sử giao dịch
  const transactionCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      const cat = t.category?.trim();
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [transactions]);

  // Lọc giao dịch theo tất cả tiêu chí
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const thisMonthStr = format(now, 'yyyy-MM');
    const lastMonthStr = format(subMonths(now, 1), 'yyyy-MM');
    const startWeekStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const endWeekStr = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    return transactions.filter(t => {
      // 1. Lọc theo Loại (Thu / Chi)
      if (filterType !== 'all' && t.type !== filterType) {
        return false;
      }

      // 2. Lọc theo Hạng mục
      if (filterCategory !== 'all') {
        if (!t.category || t.category.trim().toLowerCase() !== filterCategory.trim().toLowerCase()) {
          return false;
        }
      }

      // 3. Lọc theo Kế hoạch
      if (filterPlan !== 'all') {
        if (filterPlan === 'with_plan' && !t.planId) {
          return false;
        }
        if (filterPlan === 'no_plan' && t.planId) {
          return false;
        }
        if (filterPlan !== 'with_plan' && filterPlan !== 'no_plan' && t.planId !== filterPlan) {
          return false;
        }
      }

      // 4. Lọc theo Thời gian
      if (filterTime !== 'all') {
        let txDateStr = '';
        if (t.date?.toDate) {
          txDateStr = format(t.date.toDate(), 'yyyy-MM-dd');
        } else if (t.date instanceof Date) {
          txDateStr = format(t.date, 'yyyy-MM-dd');
        } else if (typeof t.date === 'string') {
          txDateStr = t.date.slice(0, 10);
        }

        if (!txDateStr) return false;

        if (filterTime === 'today') {
          if (txDateStr !== todayStr) return false;
        } else if (filterTime === 'this_week') {
          if (txDateStr < startWeekStr || txDateStr > endWeekStr) return false;
        } else if (filterTime === 'this_month') {
          if (txDateStr.slice(0, 7) !== thisMonthStr) return false;
        } else if (filterTime === 'last_month') {
          if (txDateStr.slice(0, 7) !== lastMonthStr) return false;
        } else if (filterTime === 'custom') {
          if (customStartDate && txDateStr < customStartDate) return false;
          if (customEndDate && txDateStr > customEndDate) return false;
        }
      }

      // 5. Tìm kiếm theo từ khóa (Mô tả, Hạng mục, Kế hoạch)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCategory = t.category?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchPlan = t.planTitle?.toLowerCase().includes(q);
        if (!matchCategory && !matchDesc && !matchPlan) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filterType, filterCategory, filterPlan, filterTime, customStartDate, customEndDate, searchQuery]);

  const isFiltered = filterCategory !== 'all' || 
    filterTime !== 'all' || 
    filterPlan !== 'all' || 
    filterType !== 'all' || 
    searchQuery.trim() !== '' || 
    Boolean(customStartDate) || 
    Boolean(customEndDate);

  const filteredIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const filteredExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const filteredBalance = filteredIncome - filteredExpense;

  const resetFilters = () => {
    setFilterCategory('all');
    setFilterTime('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterPlan('all');
    setFilterType('all');
    setSearchQuery('');
  };

  // Total planned budget from all plans
  const totalPlanBudget = plans.reduce((sum, p) => {
    const items = p.budgetItems || [];
    return sum + items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  }, 0);

  const getFormattedTxDate = (dateVal: any) => {
    if (!dateVal) return '—';
    try {
      if (dateVal.toDate) return format(dateVal.toDate(), 'dd/MM/yyyy');
      return format(new Date(dateVal), 'dd/MM/yyyy');
    } catch {
      return '—';
    }
  };

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setFormData({ 
      type: 'income', 
      amount: 0, 
      category: '', 
      description: '', 
      date: format(new Date(), 'yyyy-MM-dd'),
      planId: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t: any) => {
    setEditingTransaction(t);
    let dateStr = format(new Date(), 'yyyy-MM-dd');
    if (t.date?.toDate) {
      dateStr = format(t.date.toDate(), 'yyyy-MM-dd');
    } else if (t.date instanceof Date) {
      dateStr = format(t.date, 'yyyy-MM-dd');
    } else if (typeof t.date === 'string') {
      dateStr = t.date.slice(0, 10);
    }

    setFormData({ 
      type: t.type || 'income', 
      amount: Number(t.amount) || 0, 
      category: t.category || '', 
      description: t.description || '', 
      date: dateStr,
      planId: t.planId || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const linkedPlan = plans.find(p => p.id === formData.planId);
      const dataToSave: any = {
        type: formData.type,
        amount: Number(formData.amount),
        category: formData.category,
        description: formData.description,
        date: formData.date
      };
      if (formData.type === 'expense' && formData.planId && linkedPlan) {
        dataToSave.planId = linkedPlan.id;
        dataToSave.planTitle = linkedPlan.title;
      } else {
        dataToSave.planId = null;
        dataToSave.planTitle = null;
      }

      if (editingTransaction) {
        if (editingTransaction.budgetItemId) {
          dataToSave.budgetItemId = editingTransaction.budgetItemId;
        }
        if (editingTransaction.createdBy) {
          dataToSave.createdBy = editingTransaction.createdBy;
        }
        await updateTransaction(editingTransaction.id, dataToSave);
      } else {
        await addTransaction(dataToSave);
      }

      // Tự động lưu hạng mục đã điền và dùng vào danh sách gợi ý
      if (formData.category && formData.category.trim()) {
        saveCategoryUsage(formData.type as 'income' | 'expense', formData.category);
      }

      setShowModal(false);
      setEditingTransaction(null);
      setFormData({ 
        type: 'income', 
        amount: 0, 
        category: '', 
        description: '', 
        date: format(new Date(), 'yyyy-MM-dd'),
        planId: '' 
      });
    } catch (err) {
      console.error('Error saving transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTransaction || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(deletingTransaction.id);
      setDeletingTransaction(null);
    } catch (err) {
      console.error('Error deleting transaction:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in duration-300">
      {/* Navigation and Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Quản lý Thu Chi</h2>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">Theo dõi dòng tiền thực tế & dự toán ngân sách theo kế hoạch</p>
        </div>

        {/* Sub-tab Switcher: Sổ Thu Chi vs Dự Toán Chi Theo Kế Hoạch */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-2xl shrink-0 self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setSubTab('actual')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all",
              subTab === 'actual' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Receipt className="w-4 h-4" />
            <span>Sổ Thu Chi</span>
          </button>
          <button
            onClick={() => setSubTab('budget')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all",
              subTab === 'budget' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Wallet className="w-4 h-4" />
            <span>Dự toán chi theo kế hoạch</span>
            {totalPlanBudget > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-black bg-indigo-100 text-indigo-700 rounded-md">
                {formatCurrency(totalPlanBudget)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subtab Content */}
      {subTab === 'budget' ? (
        <PlanBudgetManager plans={plans} transactions={transactions} />
      ) : (
        <div className="space-y-4 md:space-y-6">
          {/* Quick Cashflow Summary Cards */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Tổng thu
              </span>
              <p className="text-sm md:text-xl font-black text-emerald-600 truncate">
                +{formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="bg-white p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Tổng chi
              </span>
              <p className="text-sm md:text-xl font-black text-red-600 truncate">
                -{formatCurrency(totalExpense)}
              </p>
            </div>
            <div className="bg-white p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs">
              <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Số dư hiện tại
              </span>
              <p className={cn(
                "text-sm md:text-xl font-black truncate",
                balance >= 0 ? "text-indigo-600" : "text-amber-600"
              )}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>

          {/* Table Header and Add button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Danh sách giao dịch thực tế</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  {isFiltered ? `${filteredTransactions.length} / ${transactions.length}` : `${transactions.length}`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Các khoản thu chi tiền mặt, chuyển khoản đã thực hiện</p>
            </div>
            <button 
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm giao dịch</span>
            </button>
          </div>

          {/* Advanced Filter Toolbar: Hạng mục, Thời gian, Kế hoạch, Loại, Tìm kiếm */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo hạng mục, ghi chú, kế hoạch..."
                  className="w-full pl-9 pr-8 py-2 text-xs md:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/60 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl shrink-0 self-start md:self-auto border border-slate-200/50">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    filterType === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                    filterType === 'income' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-emerald-700"
                  )}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Thu</span>
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                    filterType === 'expense' ? "bg-red-600 text-white shadow-xs" : "text-slate-500 hover:text-red-700"
                  )}
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>Chi</span>
                </button>
              </div>
            </div>

            {/* Dropdown Filters: Hạng mục, Thời gian, Kế hoạch */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
              {/* 1. Lọc theo Hạng mục */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    Hạng mục
                  </span>
                  {filterCategory !== 'all' && (
                    <span className="text-[10px] text-indigo-600 font-bold lowercase">đang lọc</span>
                  )}
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl border text-xs md:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white",
                    filterCategory !== 'all' ? "border-indigo-400 bg-indigo-50/40 text-indigo-900 font-bold" : "border-slate-200 text-slate-700"
                  )}
                >
                  <option value="all">Tất cả hạng mục ({transactionCategories.length > 0 ? transactionCategories.length : '0'})</option>
                  {transactionCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 2. Lọc theo Thời gian */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Thời gian
                  </span>
                  {filterTime !== 'all' && (
                    <span className="text-[10px] text-indigo-600 font-bold lowercase">đang lọc</span>
                  )}
                </label>
                <select
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value as any)}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl border text-xs md:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white",
                    filterTime !== 'all' ? "border-indigo-400 bg-indigo-50/40 text-indigo-900 font-bold" : "border-slate-200 text-slate-700"
                  )}
                >
                  <option value="all">Toàn bộ thời gian</option>
                  <option value="today">Hôm nay ({format(new Date(), 'dd/MM')})</option>
                  <option value="this_week">Tuần này</option>
                  <option value="this_month">Tháng này ({format(new Date(), 'MM/yyyy')})</option>
                  <option value="last_month">Tháng trước ({format(subMonths(new Date(), 1), 'MM/yyyy')})</option>
                  <option value="custom">Tùy chọn khoảng ngày...</option>
                </select>
              </div>

              {/* 3. Lọc theo Kế hoạch */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    Kế hoạch
                  </span>
                  {filterPlan !== 'all' && (
                    <span className="text-[10px] text-indigo-600 font-bold lowercase">đang lọc</span>
                  )}
                </label>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-xl border text-xs md:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white",
                    filterPlan !== 'all' ? "border-indigo-400 bg-indigo-50/40 text-indigo-900 font-bold" : "border-slate-200 text-slate-700"
                  )}
                >
                  <option value="all">Tất cả giao dịch</option>
                  <option value="with_plan">Chi thuộc kế hoạch (Dự toán)</option>
                  <option value="no_plan">Chi độc lập (Ngoài kế hoạch)</option>
                  {plans.length > 0 && (
                    <optgroup label="Chọn từng kế hoạch cụ thể:">
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Custom Date Range Inputs (when filterTime === 'custom') */}
            {filterTime === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs animate-in fade-in duration-200">
                <span className="font-bold text-indigo-900 shrink-0 flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                  Chọn mốc ngày:
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-slate-500 font-medium">Từ:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-slate-500 font-medium">Đến:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline shrink-0"
                  >
                    Xóa mốc ngày
                  </button>
                )}
              </div>
            )}

            {/* Active Filters Result Summary */}
            {isFiltered && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-700">
                    Kết quả lọc: <strong className="text-indigo-600 font-extrabold">{filteredTransactions.length}</strong> / {transactions.length} giao dịch
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                    Thu: +{formatCurrency(filteredIncome)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold border border-red-100">
                    Chi: -{formatCurrency(filteredExpense)}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold border",
                    filteredBalance >= 0 ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  )}>
                    Chênh lệch: {formatCurrency(filteredBalance)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa bộ lọc</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Mobile View: Transaction Cards list */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTransactions.map((t) => (
                <div key={t.id} className="p-3.5 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">{getFormattedTxDate(t.date)}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                        t.type === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {t.type === 'income' ? 'Thu' : 'Chi'}
                      </span>
                    </div>
                    {/* Action buttons on Mobile */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenEdit(t)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Chỉnh sửa giao dịch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button 
                        onClick={() => setDeletingTransaction(t)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{t.category}</p>
                      {t.description && <p className="text-xs text-slate-500 mt-0.5 break-words">{t.description}</p>}
                      {t.planTitle && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 border border-indigo-100">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Kế hoạch: {t.planTitle}</span>
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm font-extrabold shrink-0 text-right",
                      t.type === 'income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isFiltered ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-600">Không có giao dịch nào phù hợp với bộ lọc</p>
                      <button
                        onClick={resetFilters}
                        className="text-indigo-600 hover:underline font-bold text-xs"
                      >
                        Đặt lại bộ lọc để xem toàn bộ
                      </button>
                    </div>
                  ) : (
                    'Chưa có giao dịch nào'
                  )}
                </div>
              )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Loại</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hạng mục</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mô tả & Kế hoạch</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Số tiền</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-slate-600">{getFormattedTxDate(t.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          t.type === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        )}>
                          {t.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{t.category}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div>
                          <p className="text-slate-800 font-medium">{t.description || '—'}</p>
                          {t.planTitle && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 border border-indigo-100">
                              <Calendar className="w-3 h-3" />
                              <span>Thuộc: {t.planTitle}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-sm font-black text-right",
                        t.type === 'income' ? "text-emerald-600" : "text-red-600"
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenEdit(t)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Chỉnh sửa khoản thu chi này"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeletingTransaction(t)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Xóa khoản thu chi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        {isFiltered ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-slate-600">Không tìm thấy giao dịch nào phù hợp với bộ lọc</p>
                            <button
                              onClick={resetFilters}
                              className="text-indigo-600 hover:underline font-bold text-xs"
                            >
                              Đặt lại bộ lọc để xem toàn bộ
                            </button>
                          </div>
                        ) : (
                          'Chưa có giao dịch nào'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm / Sửa giao dịch */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0",
                    editingTransaction 
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-100" 
                      : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  )}>
                    {editingTransaction ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900">
                      {editingTransaction ? "Chỉnh sửa khoản thu chi" : "Thêm giao dịch mới"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {editingTransaction ? "Cập nhật lại số tiền, ngày hoặc hạng mục đã nhập" : "Ghi nhận khoản thu tiền hoặc chi phí mới"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Loại giao dịch</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'income'})}
                      className={cn("py-2.5 rounded-xl text-xs md:text-sm font-bold border-2 transition-all", formData.type === 'income' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-400")}
                    >Thu tiền</button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'expense'})}
                      className={cn("py-2.5 rounded-xl text-xs md:text-sm font-bold border-2 transition-all", formData.type === 'expense' ? "border-red-500 bg-red-50 text-red-700" : "border-slate-100 text-slate-400")}
                    >Chi tiền</button>
                  </div>
                </div>

                {/* Plan Linkage (When Expense) */}
                {formData.type === 'expense' && plans.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Thuộc kế hoạch (Dự toán chi phí - Tùy chọn)
                    </label>
                    <select
                      value={formData.planId}
                      onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- Không gắn vào kế hoạch nào --</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    {formData.planId && (
                      <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Khoản chi này sẽ tính vào tiến độ giải ngân của kế hoạch đã chọn.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Số tiền (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <span className={cn(
                      "text-xs font-black",
                      formData.type === 'income' ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(formData.amount || 0)}
                    </span>
                  </div>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="1000"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Nhập số tiền..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Hạng mục <span className="text-red-500">*</span>
                    </label>
                    {formData.category.trim() && !availableCategories.some(c => c.toLowerCase() === formData.category.trim().toLowerCase()) && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        Tự động lưu thẻ này
                      </span>
                    )}
                  </div>
                  
                  <input 
                    type="text" 
                    required
                    list="category-suggestions-list"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="VD: Bán nấm sò, Tiền điện, Mua phôi giống..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-2 font-medium"
                  />
                  <datalist id="category-suggestions-list">
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>

                  {/* Quick Category Chips with auto-saved & used categories */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] px-0.5">
                      <span className="flex items-center gap-1 text-slate-600 font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Thẻ gợi ý đã dùng & mẫu ({availableCategories.length}):</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Bấm chọn nhanh</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
                      {availableCategories.map(cat => {
                        const isSelected = formData.category.trim().toLowerCase() === cat.toLowerCase();
                        const isCustomOrUsed = (customCategories[formData.type as 'income' | 'expense'] || []).some(
                          c => c.toLowerCase() === cat.toLowerCase()
                        ) || transactions.some(t => t.type === formData.type && t.category?.trim().toLowerCase() === cat.toLowerCase());

                        return (
                          <div
                            key={cat}
                            onClick={() => setFormData({ ...formData, category: cat })}
                            className={cn(
                              "group inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all border cursor-pointer select-none",
                              isSelected 
                                ? (formData.type === 'income' 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" 
                                    : "bg-red-600 text-white border-red-600 shadow-xs")
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                            )}
                          >
                            <span>{cat}</span>
                            {isCustomOrUsed && (
                              <button
                                type="button"
                                onClick={(e) => removeCategorySuggestion(formData.type as 'income' | 'expense', cat, e)}
                                className={cn(
                                  "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 -mr-1",
                                  isSelected ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-red-500"
                                )}
                                title="Xóa khỏi danh sách gợi ý"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {availableCategories.length === 0 && (
                        <p className="text-xs text-slate-400 py-1 px-2 italic">Chưa có gợi ý nào</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Mô tả chi tiết</label>
                  <input 
                    type="text" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="VD: Chuyển khoản qua Vietcombank, 500 bịch giống..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ngày giao dịch</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    <span>{isSubmitting ? "Đang lưu..." : (editingTransaction ? "Cập nhật thay đổi" : "Lưu giao dịch")}</span>
                  </button>
                </div>

                {editingTransaction && (
                  <div className="pt-2 border-t border-slate-100 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const toDelete = editingTransaction;
                        setShowModal(false);
                        setDeletingTransaction(toDelete);
                      }}
                      className="text-red-500 hover:text-red-700 text-xs font-bold inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa khoản giao dịch này</span>
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Xác nhận xóa giao dịch */}
      <AnimatePresence>
        {deletingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-7 w-full max-w-sm shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                Xóa khoản {deletingTransaction.type === 'income' ? 'thu' : 'chi'} này?
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Hạng mục: <span className="font-bold text-slate-800">{deletingTransaction.category}</span>
                <br />
                Số tiền: <span className={cn("font-black", deletingTransaction.type === 'income' ? "text-emerald-600" : "text-red-600")}>
                  {deletingTransaction.type === 'income' ? '+' : '-'}{formatCurrency(deletingTransaction.amount)}
                </span>
                <br />
                Ngày: <span className="font-semibold text-slate-700">{getFormattedTxDate(deletingTransaction.date)}</span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingTransaction(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm shadow-red-200 flex items-center justify-center gap-1.5"
                >
                  {isDeleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isDeleting ? "Đang xóa..." : "Xác nhận xóa"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Orders = ({ orders }: { orders: any[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    customerName: '', 
    customerPhone: '', 
    totalAmount: 0, 
    items: '', 
    status: 'pending',
    orderTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addOrder(formData);
    setShowModal(false);
    setFormData({ 
      customerName: '', 
      customerPhone: '', 
      totalAmount: 0, 
      items: '', 
      status: 'pending',
      orderTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateOrderStatus(id, status);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Quản lý Đơn hàng</h2>
          <p className="text-slate-500 text-xs md:text-sm">Theo dõi trạng thái và doanh thu đơn hàng</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-2 md:px-5 md:py-3 bg-indigo-600 text-white rounded-xl text-xs md:text-base font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 shrink-0"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>Tạo đơn hàng</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {orders.map((order) => {
          const displayTime = order.orderTime ? order.orderTime.toDate() : order.createdAt.toDate();
          return (
            <motion.div 
              layout
              key={order.id} 
              className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={cn(
                    "px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider",
                    order.status === 'pending' ? "bg-amber-100 text-amber-700" :
                    order.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                    "bg-indigo-100 text-indigo-700"
                  )}>
                    {order.status}
                  </span>
                  <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {format(displayTime, 'HH:mm dd/MM/yyyy')}
                  </p>
                </div>
                <h3 className="text-base md:text-lg font-bold text-slate-900">{order.customerName}</h3>
                {order.customerPhone && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{order.customerPhone}</span>
                  </p>
                )}
                <p className="text-xs md:text-sm text-slate-600 mt-2.5 line-clamp-3 bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100">{order.items}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-base md:text-lg font-bold text-indigo-600">{formatCurrency(order.totalAmount)}</p>
                <select 
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="text-xs font-bold bg-slate-50 border-none rounded-lg px-2 py-1 focus:ring-0 cursor-pointer text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <option value="pending">Chờ xử lý</option>
                  <option value="processing">Đang xử lý</option>
                  <option value="shipped">Đã giao đi</option>
                  <option value="delivered">Hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            </motion.div>
          );
        })}
        {orders.length === 0 && <div className="col-span-full py-12 md:py-20 text-center text-slate-400 text-xs md:text-sm">Chưa có đơn hàng nào</div>}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Tạo đơn hàng mới</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tên khách hàng</label>
                  <input 
                    type="text" 
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số điện thoại liên hệ</label>
                  <input 
                    type="tel" 
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="VD: 0987654321"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Thời gian đơn hàng</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.orderTime}
                    onChange={(e) => setFormData({...formData, orderTime: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tổng tiền</label>
                  <input 
                    type="number" 
                    required
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({...formData, totalAmount: Number(e.target.value)})}
                    placeholder="Nhập số tiền"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sản phẩm / Ghi chú</label>
                  <textarea 
                    rows={3}
                    value={formData.items}
                    onChange={(e) => setFormData({...formData, items: e.target.value})}
                    placeholder="VD: 2 Trà sữa Matcha ít đường..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                  Tạo đơn hàng
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Workers = ({ workers }: { workers: any[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: '', phone: '', salary: 0, status: 'active' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addWorker(formData);
    setShowModal(false);
    setFormData({ name: '', role: '', phone: '', salary: 0, status: 'active' });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Quản lý Nhân sự</h2>
          <p className="text-slate-500 text-xs md:text-sm">Danh sách và vai trò nhân viên</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-3 py-2 md:px-5 md:py-3 bg-indigo-600 text-white rounded-xl text-xs md:text-base font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 shrink-0"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>Thêm nhân viên</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {workers.map((worker) => (
          <div key={worker.id} className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-lg md:text-xl font-bold">
                  {worker.name.charAt(0)}
                </div>
              </div>
              <h3 className="text-sm md:text-lg font-bold text-slate-900 line-clamp-1">{worker.name}</h3>
              <p className="text-xs md:text-sm text-indigo-600 font-medium line-clamp-1 mt-0.5">{worker.role}</p>
              <div className="mt-3 space-y-1 text-slate-500 text-[10px] md:text-xs">
                <p className="truncate">SĐT: {worker.phone || "N/A"}</p>
                <p className="truncate">Lương: {formatCurrency(worker.salary)}</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider",
                worker.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              )}>
                {worker.status === 'active' ? 'Đang làm' : 'Nghỉ việc'}
              </span>
            </div>
          </div>
        ))}
        {workers.length === 0 && <div className="col-span-full py-12 md:py-20 text-center text-slate-400 text-xs md:text-sm">Chưa có nhân viên nào</div>}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Thêm nhân viên mới</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Họ và tên</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vị trí / Vai trò</label>
                  <input 
                    type="text" 
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số điện thoại</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mức lương</label>
                  <input 
                    type="number" 
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100">
                  Thêm nhân viên
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubT = subscribeTransactions(setTransactions);
    const unsubO = subscribeOrders(setOrders);
    const unsubW = subscribeWorkers(setWorkers);
    const unsubP = subscribePlans(setPlans);

    return () => {
      unsubT();
      unsubO();
      unsubW();
      unsubP();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center">
          <img 
            src="/app-icon.png" 
            alt="Trại Nấm Michfarm" 
            className="w-20 h-20 rounded-2xl shadow-md border border-emerald-100 mx-auto mb-6 object-cover" 
            referrerPolicy="no-referrer" 
          />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Trại Nấm Michfarm</h1>
          <p className="text-slate-500 mb-8 text-sm">Vui lòng đăng nhập để quản lý trang trại của bạn</p>
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <LogIn className="w-5 h-5" /> Đăng nhập với Google
          </button>
          <div className="mt-4 flex justify-center">
            <PWAInstallButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans text-slate-900">
      <OfflineIndicator />
      {/* Sidebar for Desktop */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      
      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img 
            src="/app-icon.png" 
            alt="Trại Nấm Michfarm" 
            className="w-8 h-8 rounded-lg shadow-xs shrink-0 object-cover border border-emerald-100" 
            referrerPolicy="no-referrer" 
          />
          <span className="text-lg font-black text-emerald-800 tracking-tight">Trại Nấm Michfarm</span>
        </div>
        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" />
          {user && (
            <div className="flex items-center gap-2">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
              <button 
                onClick={() => signOut(auth)}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-50 rounded-xl transition-all"
                title="Đăng xuất"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard transactions={transactions} orders={orders} workers={workers} plans={plans} />}
              {activeTab === 'transactions' && <Transactions transactions={transactions} plans={plans} />}
              {activeTab === 'orders' && <Orders orders={orders} />}
              {activeTab === 'workers' && <Workers workers={workers} />}
              {activeTab === 'plans' && <Plans plans={plans} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/80 backdrop-blur-md px-2 py-2 z-40 justify-around items-center shadow-lg rounded-t-2xl">
        {[
          { id: 'plans', label: 'Kế hoạch', icon: CalendarDays },
          { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { id: 'transactions', label: 'Thu chi', icon: Receipt },
          { id: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
          { id: 'workers', label: 'Nhân sự', icon: Users },
        ].map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 text-center min-w-[64px]",
                isActive 
                  ? "text-indigo-600 font-bold bg-indigo-50/80" 
                  : "text-slate-500 font-medium hover:text-slate-800"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "scale-110")} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
