/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  RotateCcw
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
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
            <MushroomIcon className="w-5.5 h-5.5" />
          </div>
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

const Transactions = ({ transactions, plans = [] }: { transactions: any[]; plans?: any[] }) => {
  const [subTab, setSubTab] = useState<'actual' | 'budget'>('actual');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    type: 'income', 
    amount: 0, 
    category: '', 
    description: '', 
    date: format(new Date(), 'yyyy-MM-dd'),
    planId: ''
  });

  const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  // Total planned budget from all plans
  const totalPlanBudget = plans.reduce((sum, p) => {
    const items = p.budgetItems || [];
    return sum + items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }

    await addTransaction(dataToSave);
    setShowModal(false);
    setFormData({ 
      type: 'income', 
      amount: 0, 
      category: '', 
      description: '', 
      date: format(new Date(), 'yyyy-MM-dd'),
      planId: '' 
    });
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Danh sách giao dịch thực tế</h3>
              <p className="text-xs text-slate-400">Các khoản thu chi tiền mặt, chuyển khoản đã thực hiện</p>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 px-3.5 py-2 md:px-5 md:py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm giao dịch</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Mobile View: Transaction Cards list */}
            <div className="block md:hidden divide-y divide-slate-100">
              {transactions.map((t) => (
                <div key={t.id} className="p-3.5 flex flex-col gap-1.5 hover:bg-slate-50/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">{format(t.date.toDate(), 'dd/MM/yyyy')}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                      t.type === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {t.type === 'income' ? 'Thu' : 'Chi'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{t.category}</p>
                      {t.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{t.description}</p>}
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
              {transactions.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Chưa có giao dịch nào</div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">{format(t.date.toDate(), 'dd/MM/yyyy')}</td>
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
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">Chưa có giao dịch nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm giao dịch mới */}
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
                <h3 className="text-lg md:text-xl font-black text-slate-900">Thêm giao dịch mới</h3>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Hạng mục</label>
                  <input 
                    type="text" 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    placeholder="VD: Bán nấm sò, Tiền điện, Mua phôi giống..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
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
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md shadow-indigo-100"
                  >
                    Lưu giao dịch
                  </button>
                </div>
              </form>
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
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm mx-auto mb-6">
            <MushroomIcon className="w-10 h-10" />
          </div>
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
            <MushroomIcon className="w-5.5 h-5.5" />
          </div>
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
