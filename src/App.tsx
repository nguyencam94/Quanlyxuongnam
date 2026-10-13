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
  subscribeCampaigns,
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
  isToday,
  addDays,
  isAfter,
  isBefore
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
  Search,
  BarChart3,
  Sprout
} from 'lucide-react';
import { PlanBudgetManager } from './components/PlanBudgetManager';
import { ExtendPlanModal } from './components/ExtendPlanModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TransactionOverview } from './components/TransactionOverview';
import { Campaigns } from './components/Campaigns';

// --- Types ---
type Tab = 'dashboard' | 'campaigns' | 'plans' | 'transactions' | 'orders' | 'workers';

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

const Plans = ({ plans, campaigns = [] }: { plans: any[]; campaigns?: any[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    startDate: format(new Date(), "yyyy-MM-dd'T'08:00"), 
    endDate: format(addDays(new Date(), 1), "yyyy-MM-dd'T'18:00"), 
    status: 'todo',
    campaignId: '',
    subtasks: [] as any[]
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [inlineSubtask, setInlineSubtask] = useState('');
  const [planToExtend, setPlanToExtend] = useState<any | null>(null);
  const [listStatusFilter, setListStatusFilter] = useState<'all' | 'todo' | 'in-progress' | 'done' | 'overdue'>('all');
  const [listSearch, setListSearch] = useState('');

  const getPlanStartDate = (plan: any): Date | null => {
    if (!plan?.startDate) return null;
    return plan.startDate?.toDate ? plan.startDate.toDate() : new Date(plan.startDate);
  };

  const getPlanEndDate = (plan: any): Date | null => {
    if (plan?.endDate) {
      return plan.endDate?.toDate ? plan.endDate.toDate() : new Date(plan.endDate);
    }
    if (plan?.startDate) {
      return plan.startDate?.toDate ? plan.startDate.toDate() : new Date(plan.startDate);
    }
    return null;
  };

  // Kept for backward compatibility
  const getPlanDate = getPlanEndDate;

  const openAddModalForDate = (date: Date) => {
    setEditingPlan(null);
    setDateError(null);
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = new Date();
    const startTimeStr = isSameDay(date, now) ? format(now, 'HH:mm') : '08:00';
    const startIso = `${dateStr}T${startTimeStr}`;
    const endIso = `${dateStr}T18:00`;
    const finalEndIso = isAfter(new Date(startIso), new Date(endIso))
      ? `${format(addDays(date, 1), 'yyyy-MM-dd')}T18:00`
      : endIso;

    setFormData({ 
      title: '', 
      description: '', 
      startDate: startIso, 
      endDate: finalEndIso, 
      status: 'todo',
      campaignId: '',
      subtasks: []
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setDateError(null);
    const dateStr = format(selectedDate || new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const startTimeStr = isSameDay(selectedDate || now, now) ? format(now, 'HH:mm') : '08:00';
    const startIso = `${dateStr}T${startTimeStr}`;
    const endIso = `${dateStr}T18:00`;
    const finalEndIso = isAfter(new Date(startIso), new Date(endIso))
      ? `${format(addDays(selectedDate || now, 1), 'yyyy-MM-dd')}T18:00`
      : endIso;

    setFormData({ 
      title: '', 
      description: '', 
      startDate: startIso, 
      endDate: finalEndIso, 
      status: 'todo',
      campaignId: '',
      subtasks: []
    });
  };

  useEffect(() => {
    if (editingPlan) {
      setDateError(null);
      const sDate = getPlanStartDate(editingPlan);
      const eDate = getPlanEndDate(editingPlan);
      setFormData({
        title: editingPlan.title,
        description: editingPlan.description || '',
        startDate: sDate ? format(sDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        endDate: eDate ? format(eDate, "yyyy-MM-dd'T'HH:mm") : (sDate ? format(sDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm")),
        status: editingPlan.status,
        campaignId: editingPlan.campaignId || '',
        subtasks: editingPlan.subtasks || []
      });
      setShowModal(true);
    }
  }, [editingPlan]);

  // Tự động kiểm tra: Mục tiêu nào đã hoàn thành đủ tất cả hạng mục thì tự động gán là hoàn thành
  useEffect(() => {
    plans.forEach(async (plan) => {
      if (plan.subtasks && plan.subtasks.length > 0) {
        const allCompleted = plan.subtasks.every((st: any) => st.completed);
        if (allCompleted && plan.status !== 'done') {
          try {
            await updatePlan(plan.id, { status: 'done' });
          } catch (e) {
            console.error('Lỗi khi tự động gán hoàn thành kế hoạch:', e);
          }
        }
      }
    });
  }, [plans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setDateError('Thời hạn hoàn thành phải sau hoặc bằng ngày bắt đầu mục tiêu.');
      return;
    }
    setDateError(null);
    const dataToSave: any = { ...formData };
    if (dataToSave.campaignId) {
      const matched = campaigns.find(c => c.id === dataToSave.campaignId);
      dataToSave.campaignName = matched ? matched.name : '';
    } else {
      dataToSave.campaignId = null;
      dataToSave.campaignName = null;
    }

    if (dataToSave.subtasks && dataToSave.subtasks.length > 0 && dataToSave.subtasks.every((st: any) => st.completed)) {
      dataToSave.status = 'done';
    }
    if (editingPlan) {
      await updatePlan(editingPlan.id, dataToSave);
    } else {
      await addPlan(dataToSave);
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
    const updatedSubtasks = [...formData.subtasks, subtask];
    setFormData({ 
      ...formData, 
      subtasks: updatedSubtasks,
      status: formData.status === 'done' ? 'in-progress' : formData.status
    });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    const updatedSubtasks = formData.subtasks.map(st => 
      st.id === id ? { ...st, completed: !st.completed } : st
    );
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
    let nextStatus = formData.status;
    if (allCompleted) {
      nextStatus = 'done';
    } else if (formData.status === 'done') {
      nextStatus = 'in-progress';
    }
    setFormData({ ...formData, subtasks: updatedSubtasks, status: nextStatus });
  };

  const removeSubtask = (id: string) => {
    const updatedSubtasks = formData.subtasks.filter(st => st.id !== id);
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
    let nextStatus = formData.status;
    if (allCompleted) {
      nextStatus = 'done';
    }
    setFormData({ ...formData, subtasks: updatedSubtasks, status: nextStatus });
  };

  const togglePlanStatus = async (plan: any) => {
    const newStatus = plan.status === 'done' ? 'todo' : 'done';
    const updates: any = { status: newStatus };
    if (newStatus === 'done' && plan.subtasks && plan.subtasks.length > 0) {
      updates.subtasks = plan.subtasks.map((st: any) => ({ ...st, completed: true }));
    }
    await updatePlan(plan.id, updates);
  };

  const toggleSubtaskInList = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.map((st: any) => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((st: any) => st.completed);
    const updates: any = { subtasks: updatedSubtasks };
    if (allCompleted && plan.status !== 'done') {
      updates.status = 'done';
    } else if (!allCompleted && plan.status === 'done') {
      updates.status = 'in-progress';
    }
    await updatePlan(plan.id, updates);
  };

  // Inline Handlers for Detail View
  const handleAddSubtaskDetail = async (plan: any, title: string) => {
    const subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: title,
      completed: false
    };
    const updatedSubtasks = [...(plan.subtasks || []), subtask];
    const updates: any = { subtasks: updatedSubtasks };
    if (plan.status === 'done') {
      updates.status = 'in-progress';
    }
    await updatePlan(plan.id, updates);
  };

  const handleToggleSubtaskDetail = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.map((st: any) => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((st: any) => st.completed);
    const updates: any = { subtasks: updatedSubtasks };
    if (allCompleted && plan.status !== 'done') {
      updates.status = 'done';
    } else if (!allCompleted && plan.status === 'done') {
      updates.status = 'in-progress';
    }
    await updatePlan(plan.id, updates);
  };

  const handleRemoveSubtaskDetail = async (plan: any, subtaskId: string) => {
    const updatedSubtasks = plan.subtasks.filter((st: any) => st.id !== subtaskId);
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((st: any) => st.completed);
    const updates: any = { subtasks: updatedSubtasks };
    if (allCompleted && plan.status !== 'done') {
      updates.status = 'done';
    }
    await updatePlan(plan.id, updates);
  };

  const handleTogglePlanStatusDetail = async (plan: any) => {
    const newStatus = plan.status === 'done' ? 'todo' : 'done';
    const updates: any = { status: newStatus };
    if (newStatus === 'done' && plan.subtasks && plan.subtasks.length > 0) {
      updates.subtasks = plan.subtasks.map((st: any) => ({ ...st, completed: true }));
    }
    await updatePlan(plan.id, updates);
  };

  // Find active selected plan
  const activePlan = plans.find(p => p.id === selectedPlanId);

  // Render Plan Details View if activePlan exists
  if (activePlan) {
    const totalSubtasks = activePlan.subtasks?.length || 0;
    const completedSubtasks = activePlan.subtasks?.filter((st: any) => st.completed).length || 0;
    const completionPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
    const activePlanStartDate = getPlanStartDate(activePlan);
    const activePlanEndDate = getPlanEndDate(activePlan);
    const isActiveOverdue = activePlanEndDate ? (isPast(activePlanEndDate) && activePlan.status !== 'done') : false;
    const extensionCount = activePlan.extensionCount || (activePlan.extensions?.length || 0);

    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300">
        {/* Back & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-xs md:bg-transparent md:p-0 md:border-none md:shadow-none">
          <button 
            onClick={() => setSelectedPlanId(null)}
            className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-bold transition-all px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs sm:text-sm self-start min-h-[44px] active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span>Quay lại</span>
          </button>
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setPlanToExtend(activePlan)}
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-amber-50 text-amber-800 font-bold hover:bg-amber-100 rounded-xl transition-all text-xs md:text-sm border border-amber-200 active:scale-95 min-h-[44px] touch-manipulation"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Gia hạn {extensionCount > 0 ? `(${extensionCount + 1})` : ''}</span>
            </button>
            <button 
              onClick={() => setEditingPlan(activePlan)}
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 rounded-xl transition-all text-xs md:text-sm active:scale-95 min-h-[44px] touch-manipulation"
            >
              <Edit2 className="w-3.5 h-3.5 shrink-0" />
              <span>Sửa</span>
            </button>
            <button 
              onClick={() => setPlanToDelete(activePlan.id)}
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-red-50 text-red-600 font-bold hover:bg-red-100 rounded-xl transition-all text-xs md:text-sm active:scale-95 min-h-[44px] touch-manipulation"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Xóa</span>
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
                  {activePlan.originalEndDate ? (
                    <span>Hạn ban đầu: <strong className="font-bold">{format(activePlan.originalEndDate.toDate ? activePlan.originalEndDate.toDate() : new Date(activePlan.originalEndDate), 'HH:mm - dd/MM/yyyy')}</strong> &rarr; </span>
                  ) : activePlan.originalStartDate ? (
                    <span>Hạn ban đầu: <strong className="font-bold">{format(activePlan.originalStartDate.toDate ? activePlan.originalStartDate.toDate() : new Date(activePlan.originalStartDate), 'HH:mm - dd/MM/yyyy')}</strong> &rarr; </span>
                  ) : null}
                  Hạn hiện tại: <strong className="font-bold">{activePlanEndDate ? format(activePlanEndDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}</strong>
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
                    "min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 -mt-1 p-2 rounded-xl transition-transform active:scale-90 touch-manipulation shrink-0",
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
                    {activePlanEndDate && <CountdownTimer targetDate={activePlanEndDate} />}
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
                  className="flex-1 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                />
                <button 
                  type="submit" 
                  className="px-4 py-2.5 sm:px-5 sm:py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 text-xs sm:text-sm shrink-0 min-h-[44px] active:scale-95 touch-manipulation"
                >
                  <Plus className="w-4 h-4" /> <span>Thêm</span>
                </button>
              </form>

              {/* List of subtasks */}
              <div className="space-y-2">
                {activePlan.subtasks && activePlan.subtasks.length > 0 ? (
                  activePlan.subtasks.map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50/70 rounded-xl md:rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all group">
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        <button 
                          onClick={() => handleToggleSubtaskDetail(activePlan, st.id)}
                          className={cn(
                            "min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 p-2 rounded-xl transition-transform active:scale-90 touch-manipulation shrink-0",
                            st.completed ? "text-emerald-500" : "text-slate-300 hover:text-indigo-500"
                          )}
                        >
                          {st.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                        <span className={cn(
                          "text-xs sm:text-sm font-semibold transition-all break-words select-none cursor-pointer flex-1",
                          st.completed ? "text-slate-400 line-through" : "text-slate-700"
                        )}
                        onClick={() => handleToggleSubtaskDetail(activePlan, st.id)}
                        >
                          {st.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemoveSubtaskDetail(activePlan, st.id)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0 active:scale-95 touch-manipulation"
                        title="Xóa hạng mục này"
                      >
                        <Trash className="w-4 h-4" />
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
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Thời gian & Hạn chót</h3>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>Ngày bắt đầu:</span>
                  </span>
                  <span className="font-bold text-slate-800 text-right">
                    {activePlanStartDate ? format(activePlanStartDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span>Hạn hoàn thành:</span>
                  </span>
                  <span className="font-bold text-rose-700 text-right">
                    {activePlanEndDate ? format(activePlanEndDate, 'HH:mm - dd/MM/yyyy') : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                  <span className="text-slate-500">Thời gian còn lại:</span>
                  {activePlanEndDate && <CountdownTimer targetDate={activePlanEndDate} />}
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
                {activePlan.campaignName && (
                  <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Chiến dịch:</span>
                    </span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-xs">
                      {activePlan.campaignName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs md:text-sm py-1.5 md:py-2">
                  <span className="text-slate-500">Trạng thái:</span>
                  <select 
                    value={activePlan.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      const updates: any = { status: newStatus };
                      if (newStatus === 'done' && activePlan.subtasks && activePlan.subtasks.length > 0) {
                        updates.subtasks = activePlan.subtasks.map((st: any) => ({ ...st, completed: true }));
                      }
                      await updatePlan(activePlan.id, updates);
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
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
                    {campaigns && campaigns.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                          <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Thuộc Chiến dịch / Đợt vào nấm (Tùy chọn)</span>
                        </label>
                        <select
                          value={formData.campaignId || ''}
                          onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white font-medium text-sm"
                        >
                          <option value="">-- Không thuộc đợt nào (Kế hoạch chung) --</option>
                          {campaigns.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.variety ? `(${c.variety})` : ''} {c.location ? `— ${c.location}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200"></span>
                          <span>Ngày bắt đầu mục tiêu</span>
                        </label>
                        <input 
                          type="datetime-local" 
                          required
                          value={formData.startDate}
                          onChange={(e) => {
                            setFormData({...formData, startDate: e.target.value});
                            setDateError(null);
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-emerald-50/20 focus:bg-white text-base sm:text-sm min-h-[44px]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Mốc bắt đầu triển khai mục tiêu</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-rose-800 uppercase mb-2 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-200"></span>
                          <span>Thời hạn hoàn thành</span>
                        </label>
                        <input 
                          type="datetime-local" 
                          required
                          value={formData.endDate}
                          onChange={(e) => {
                            setFormData({...formData, endDate: e.target.value});
                            setDateError(null);
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none transition-all bg-rose-50/20 focus:bg-white text-base sm:text-sm min-h-[44px]"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Hạn chót hoàn thành mục tiêu</p>
                      </div>
                    </div>

                    {dateError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                        <span>{dateError}</span>
                      </div>
                    )}
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

  const getStartingPlansForDate = (date: Date) => {
    return plans.filter(p => {
      const pStart = getPlanStartDate(p);
      return pStart ? isSameDay(pStart, date) : false;
    });
  };

  const getDuePlansForDate = (date: Date) => {
    return plans.filter(p => {
      const pEnd = getPlanEndDate(p);
      return pEnd ? isSameDay(pEnd, date) : false;
    });
  };

  const getPlansForDate = (date: Date) => {
    return plans.filter(p => {
      const pStart = getPlanStartDate(p);
      const pEnd = getPlanEndDate(p);
      return (pStart && isSameDay(pStart, date)) || (pEnd && isSameDay(pEnd, date));
    });
  };

  const selectedDayPlans = getPlansForDate(selectedDate);
  const currentMonthPlans = plans.filter(p => {
    const pStart = getPlanStartDate(p);
    const pEnd = getPlanEndDate(p);
    return (pStart && isSameMonth(pStart, currentMonth)) || (pEnd && isSameMonth(pEnd, currentMonth));
  });

  const filteredListPlans = useMemo(() => {
    return plans.filter(p => {
      if (listStatusFilter === 'todo' && p.status !== 'todo') return false;
      if (listStatusFilter === 'in-progress' && p.status !== 'in-progress') return false;
      if (listStatusFilter === 'done' && p.status !== 'done') return false;
      if (listStatusFilter === 'overdue') {
        const pEnd = getPlanEndDate(p);
        if (!pEnd || !isPast(pEnd) || p.status === 'done') return false;
      }
      if (listSearch.trim()) {
        const q = listSearch.toLowerCase().trim();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [plans, listStatusFilter, listSearch]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Kế hoạch làm việc</h2>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">Lên lịch theo dõi nhiệm vụ theo cuốn lịch hoặc danh sách</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          {/* View Mode Toggle Switch */}
          <div className="flex-1 sm:flex-initial flex bg-slate-200/70 p-1 rounded-2xl shadow-inner border border-slate-200/50">
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] active:scale-95 touch-manipulation",
                viewMode === 'calendar' 
                  ? "bg-white text-indigo-700 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Theo lịch</span>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] active:scale-95 touch-manipulation",
                viewMode === 'list' 
                  ? "bg-white text-indigo-700 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List className="w-4 h-4" />
              <span>Danh sách</span>
            </button>
          </div>

          <button 
            onClick={() => openAddModalForDate(selectedDate)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 shrink-0 min-h-[44px] active:scale-95 touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Thêm nhiệm vụ</span>
            <span className="xs:hidden">Thêm mới</span>
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-4 md:space-y-6">
          {/* Calendar Book Component */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm p-4 md:p-6">
            {/* Calendar Navigation & Month Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 sm:mb-5 sm:pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-700 active:scale-95 touch-manipulation"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-base sm:text-xl font-black text-slate-900 capitalize text-center px-1 truncate min-w-[130px] sm:min-w-[180px]">
                    {format(currentMonth, 'MMMM yyyy', { locale: vi })}
                  </h3>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-700 active:scale-95 touch-manipulation"
                    title="Tháng sau"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(today);
                    setSelectedDate(today);
                  }}
                  className="px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all active:scale-95 shrink-0 min-h-[40px] touch-manipulation"
                >
                  Hôm nay
                </button>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-2.5 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-100 text-[11px] sm:text-xs">
                    {currentMonthPlans.length} kế hoạch
                  </span>
                  <span className="text-[11px] sm:text-xs">trong tháng</span>
                </div>
                {/* Legend: Chấm xanh = Bắt đầu, Chấm đỏ = Đến hạn */}
                <div className="flex items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-3 text-[11px] flex-wrap">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs ring-1 ring-emerald-300"></span>
                    <span>Bắt đầu mục tiêu</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-xs ring-1 ring-rose-300"></span>
                    <span>Đến hạn mục tiêu</span>
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
                    "text-center py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                    idx >= 5 ? "text-amber-600" : "text-slate-500"
                  )}
                >
                  <span className="hidden sm:inline">{dayName}</span>
                  <span className="sm:hidden">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][idx]}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const startingPlans = getStartingPlansForDate(day);
                const duePlans = getDuePlansForDate(day);
                const totalDayEvents = startingPlans.length + duePlans.length;

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
                      {/* Mobile View: Dấu chấm xanh (Bắt đầu) & Dấu chấm đỏ (Đến hạn) */}
                      <div className="flex sm:hidden items-center justify-center gap-1 mt-1 flex-wrap">
                        {startingPlans.slice(0, 3).map((p, idx) => (
                          <span 
                            key={`m-start-${p.id || idx}`} 
                            className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-300 shadow-xs" 
                            title={`Bắt đầu mục tiêu: ${p.title}`}
                          />
                        ))}
                        {duePlans.slice(0, 3).map((p, idx) => (
                          <span 
                            key={`m-due-${p.id || idx}`} 
                            className="w-2 h-2 rounded-full bg-rose-500 ring-1 ring-rose-300 shadow-xs" 
                            title={`Đến hạn mục tiêu: ${p.title}`}
                          />
                        ))}
                        {totalDayEvents > 6 && (
                          <span className="text-[8px] font-black text-slate-500">+{totalDayEvents - 6}</span>
                        )}
                      </div>

                      {/* Desktop / Tablet View: Dot indicators + Mini Task Badges */}
                      <div className="hidden sm:flex flex-col gap-1 mt-1 w-full overflow-hidden">
                        {(startingPlans.length > 0 || duePlans.length > 0) && (
                          <div className="flex items-center gap-1 mb-0.5 px-0.5 flex-wrap">
                            {startingPlans.slice(0, 4).map((p, idx) => (
                              <span 
                                key={`d-dot-start-${p.id || idx}`}
                                className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-300 shadow-xs shrink-0" 
                                title={`Bắt đầu mục tiêu: ${p.title}`}
                              />
                            ))}
                            {duePlans.slice(0, 4).map((p, idx) => (
                              <span 
                                key={`d-dot-due-${p.id || idx}`}
                                className="w-2 h-2 rounded-full bg-rose-500 ring-1 ring-rose-300 shadow-xs shrink-0" 
                                title={`Đến hạn mục tiêu: ${p.title}`}
                              />
                            ))}
                            {totalDayEvents > 8 && (
                              <span className="text-[8px] font-black text-slate-400">+{totalDayEvents - 8}</span>
                            )}
                          </div>
                        )}

                        {/* Starting badges (Green) */}
                        {startingPlans.slice(0, 2).map((p) => (
                          <div
                            key={`start-badge-${p.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlanId(p.id);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded truncate font-medium border text-left transition-all bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                            title={`[Bắt đầu] ${p.title}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate">{p.title}</span>
                          </div>
                        ))}

                        {/* Due badges (Red) */}
                        {duePlans.slice(0, 2).map((p) => (
                          <div
                            key={`due-badge-${p.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlanId(p.id);
                            }}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate font-medium border text-left transition-all flex items-center gap-1",
                              p.status === 'done'
                                ? "bg-slate-50 text-slate-400 border-slate-200 line-through opacity-75"
                                : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                            )}
                            title={`[Hạn chót] ${p.title}`}
                          >
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              p.status === 'done' ? "bg-slate-400" : "bg-rose-500"
                            )}></span>
                            <span className="truncate">{p.title}</span>
                          </div>
                        ))}

                        {totalDayEvents > 4 && (
                          <div className="text-[9px] md:text-[10px] font-bold text-slate-500 pl-1">
                            +{totalDayEvents - 4} việc nữa
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
                      ? `${selectedDayPlans.length} mục tiêu liên quan (${selectedDayPlans.filter(p => p.status === 'done').length} đã hoàn thành)`
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
                const planStartDate = getPlanStartDate(plan);
                const planEndDate = getPlanEndDate(plan);
                const isStartingToday = planStartDate ? isSameDay(planStartDate, selectedDate) : false;
                const isDueToday = planEndDate ? isSameDay(planEndDate, selectedDate) : false;
                const isOverdue = planEndDate ? (isPast(planEndDate) && plan.status !== 'done') : false;

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
                            "min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 -mt-1 p-2 rounded-xl transition-transform active:scale-90 touch-manipulation shrink-0",
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
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <h4 className={cn(
                                  "font-bold text-sm md:text-base transition-all hover:text-indigo-600 truncate",
                                  plan.status === 'done' ? "text-slate-400 line-through" : "text-slate-900"
                                )}
                                >
                                  {plan.title}
                                </h4>

                                {isStartingToday && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Bắt đầu hôm nay
                                  </span>
                                )}

                                {isDueToday && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Hạn chót hôm nay
                                  </span>
                                )}

                                {plan.extensionCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5 shrink-0">
                                    <RotateCcw className="w-2.5 h-2.5 text-amber-600" />
                                    Gia hạn lần {plan.extensionCount}
                                  </span>
                                )}

                                {plan.campaignName && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                                    <Sprout className="w-2.5 h-2.5 text-emerald-600" />
                                    {plan.campaignName}
                                  </span>
                                )}
                              </div>
                              {plan.description && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{plan.description}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between sm:justify-start gap-2 mt-1 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                              {planEndDate && <CountdownTimer targetDate={planEndDate} />}
                              {isOverdue && (
                                <button 
                                  onClick={() => setPlanToExtend(plan)}
                                  className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg text-[10px] flex items-center gap-1 transition-all shrink-0 border border-amber-200 min-h-[36px] active:scale-95 touch-manipulation"
                                  title="Gia hạn thời gian công việc"
                                >
                                  <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Gia hạn</span>
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setPlanToExtend(plan)}
                                  className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                  title="Gia hạn công việc"
                                >
                                  <CalendarClock className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setEditingPlan(plan)}
                                  className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setPlanToDelete(plan.id)}
                                  className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between text-[11px] md:text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              {planStartDate && (
                                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                  <span className="text-slate-400">Bắt đầu:</span>
                                  <span>{format(planStartDate, 'HH:mm - dd/MM/yyyy')}</span>
                                </span>
                              )}
                              {planEndDate && (
                                <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                                  <span className="text-slate-400">Hạn chót:</span>
                                  <span className="text-rose-700">{format(planEndDate, 'HH:mm - dd/MM/yyyy')}</span>
                                </span>
                              )}
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
        <div className="space-y-3.5">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Tìm kế hoạch theo tiêu đề, mô tả..."
                className="w-full pl-9 pr-8 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/60 focus:bg-white min-h-[44px]"
              />
              {listSearch && (
                <button
                  onClick={() => setListSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'todo', label: 'Chờ làm' },
                { id: 'in-progress', label: 'Đang làm' },
                { id: 'done', label: 'Hoàn thành' },
                { id: 'overdue', label: 'Quá hạn' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setListStatusFilter(tab.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 shrink-0 touch-manipulation min-h-[36px]",
                    listStatusFilter === tab.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:gap-4">
            {filteredListPlans.map((plan) => {
              const planStartDate = getPlanStartDate(plan);
              const planEndDate = getPlanEndDate(plan);
              const isOverdue = planEndDate ? (isPast(planEndDate) && plan.status !== 'done') : false;
              return (
                <motion.div 
                  layout
                  key={plan.id} 
                  className="bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-300"
                >
                  <div className="p-3.5 sm:p-5 md:p-6">
                    <div className="flex items-start gap-3 md:gap-4">
                      <button 
                        onClick={() => togglePlanStatus(plan)}
                        className={cn(
                          "min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 -mt-1 p-2 rounded-xl transition-transform active:scale-90 touch-manipulation shrink-0",
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
                              {plan.campaignName && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                                  <Sprout className="w-3 h-3 text-emerald-600" />
                                  {plan.campaignName}
                                </span>
                              )}
                            </div>
                            {plan.description && (
                              <p className="text-xs md:text-sm text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between sm:justify-start gap-2 mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                            {planEndDate && <CountdownTimer targetDate={planEndDate} />}
                            {isOverdue && (
                              <button 
                                onClick={() => setPlanToExtend(plan)}
                                className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 transition-all shrink-0 border border-amber-200 min-h-[36px] active:scale-95 touch-manipulation"
                                title="Gia hạn thời gian công việc"
                              >
                                <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Gia hạn</span>
                              </button>
                            )}
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setPlanToExtend(plan)}
                                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                title="Gia hạn công việc"
                              >
                                <CalendarClock className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingPlan(plan)}
                                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                title="Chỉnh sửa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setPlanToDelete(plan.id)}
                                className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95 touch-manipulation"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] md:text-xs">
                          <div className="flex items-center gap-3 flex-wrap">
                            {planStartDate && (
                              <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                <span className="text-slate-400">Bắt đầu:</span>
                                <span>{format(planStartDate, 'HH:mm - dd/MM/yyyy')}</span>
                              </span>
                            )}
                            {planEndDate && (
                              <span className="text-slate-700 flex items-center gap-1.5 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                                <span className="text-slate-400">Hạn chót:</span>
                                <span className="text-rose-700">{format(planEndDate, 'HH:mm - dd/MM/yyyy')}</span>
                              </span>
                            )}
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
            {filteredListPlans.length === 0 && (
              <div className="bg-white p-8 md:p-12 rounded-xl md:rounded-2xl border border-dashed border-slate-200 text-center">
                <CalendarDays className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-semibold text-sm">Không tìm thấy kế hoạch phù hợp</p>
                <p className="text-slate-400 text-xs mt-1">Thử thay đổi bộ lọc hoặc tạo một kế hoạch mới</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingPlan ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ mới'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Bắt đầu: {formData.startDate ? format(new Date(formData.startDate), 'dd/MM/yyyy') : ''}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="flex items-center gap-1 text-rose-700 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Hạn chót: {formData.endDate ? format(new Date(formData.endDate), 'dd/MM/yyyy') : ''}
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
                      placeholder="VD: Cấy meo giống đợt 3..."
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mô tả chi tiết</label>
                    <textarea 
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Ghi chú chi tiết công việc..."
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    />
                  </div>
                  {campaigns && campaigns.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Thuộc Chiến dịch / Đợt vào nấm (Tùy chọn)</span>
                      </label>
                      <select
                        value={formData.campaignId || ''}
                        onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white font-medium"
                      >
                        <option value="">-- Không thuộc đợt nào (Kế hoạch chung) --</option>
                        {campaigns.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.variety ? `(${c.variety})` : ''} {c.location ? `— ${c.location}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200"></span>
                        <span>Ngày bắt đầu mục tiêu</span>
                      </label>
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.startDate}
                        onChange={(e) => {
                          setFormData({...formData, startDate: e.target.value});
                          setDateError(null);
                        }}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[44px] bg-emerald-50/20 focus:bg-white"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Mốc bắt đầu triển khai mục tiêu</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-rose-800 uppercase mb-2 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-200"></span>
                        <span>Thời hạn hoàn thành</span>
                      </label>
                      <input 
                        type="datetime-local" 
                        required
                        value={formData.endDate}
                        onChange={(e) => {
                          setFormData({...formData, endDate: e.target.value});
                          setDateError(null);
                        }}
                        className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all min-h-[44px] bg-rose-50/20 focus:bg-white"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Hạn chót hoàn thành mục tiêu</p>
                    </div>
                  </div>

                  {dateError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{dateError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Hạng mục con (Subtasks)</label>
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Thêm hạng mục nhỏ..."
                      className="flex-1 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                    />
                    <button 
                      type="button"
                      onClick={addSubtask}
                      className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 touch-manipulation"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {formData.subtasks.map((st) => (
                      <div key={st.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl group">
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          <button 
                            type="button"
                            onClick={() => toggleSubtask(st.id)}
                            className={cn(
                              "min-w-[40px] min-h-[40px] flex items-center justify-center -ml-1 p-1.5 rounded-lg transition-transform active:scale-90 touch-manipulation shrink-0",
                              st.completed ? "text-emerald-500" : "text-slate-300"
                            )}
                          >
                            {st.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                          <span className={cn(
                            "text-xs sm:text-sm font-medium transition-all break-words flex-1 cursor-pointer select-none",
                            st.completed ? "text-slate-400 line-through" : "text-slate-700"
                          )}
                          onClick={() => toggleSubtask(st.id)}
                          >{st.title}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeSubtask(st.id)}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 active:scale-95 touch-manipulation"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 sm:py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-xs sm:text-sm min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-3 sm:py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 text-xs sm:text-sm min-h-[48px] active:scale-95 touch-manipulation"
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
    { id: 'campaigns', label: 'Chiến dịch', icon: Sprout },
    { id: 'plans', label: 'Kế hoạch', icon: CalendarDays },
    { id: 'transactions', label: 'Thu chi', icon: Receipt },
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
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

const Dashboard = ({ transactions, orders, workers, plans, campaigns = [], onNavigate }: any) => {
  const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + t.amount, 0);
  const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const chartData = [
    { name: 'Thu nhập', value: totalIncome, color: '#10b981' },
    { name: 'Chi phí', value: totalExpense, color: '#ef4444' },
  ];

  const stats = [
    { label: 'Số dư hiện tại', value: formatCurrency(balance), icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', tab: 'transactions' },
    { label: 'Đợt nấm đang chạy', value: campaigns.filter((c: any) => c.status === 'active').length, icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50', tab: 'campaigns' },
    { label: 'Kế hoạch công việc', value: plans.length, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50', tab: 'plans' },
    { label: 'Đơn hàng mới', value: orders.filter((o: any) => o.status === 'pending').length, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50', tab: 'orders' },
  ];

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      {/* Mobile Quick Action Buttons Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phím tắt nhanh</span>
          <span className="text-[11px] text-slate-400">Chạm để mở</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => onNavigate?.('campaigns')}
            className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-100 active:scale-95 touch-manipulation min-h-[44px]"
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span className="truncate">Chiến dịch</span>
          </button>
          <button
            onClick={() => onNavigate?.('plans')}
            className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-100 active:scale-95 touch-manipulation min-h-[44px]"
          >
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="truncate">Kế hoạch</span>
          </button>
          <button
            onClick={() => onNavigate?.('transactions')}
            className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-100 active:scale-95 touch-manipulation min-h-[44px]"
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span className="truncate">Sổ Thu Chi</span>
          </button>
          <button
            onClick={() => onNavigate?.('orders')}
            className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-100 active:scale-95 touch-manipulation min-h-[44px]"
          >
            <ShoppingCart className="w-4 h-4 text-amber-600" />
            <span className="truncate">Đơn hàng</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={stat.label}
            onClick={() => onNavigate?.(stat.tab)}
            className="bg-white p-3 sm:p-5 md:p-6 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-slate-200 transition-all flex flex-col justify-between cursor-pointer active:scale-98 touch-manipulation"
          >
            <div className="flex items-center justify-between mb-2 md:mb-4">
              <div className={cn("p-2 sm:p-2.5 md:p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6", stat.color)} />
              </div>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 font-semibold truncate leading-none">{stat.label}</p>
              <h3 className="text-xs sm:text-lg md:text-2xl font-black text-slate-900 mt-1.5 break-words leading-tight">{stat.value}</h3>
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

const Transactions = ({ transactions, plans = [], campaigns = [] }: { transactions: any[]; plans?: any[]; campaigns?: any[] }) => {
  const [subTab, setSubTab] = useState<'overview' | 'actual' | 'budget'>('overview');
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
    planId: '',
    campaignId: ''
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
        const matchCampaign = t.campaignName?.toLowerCase().includes(q);
        if (!matchCategory && !matchDesc && !matchPlan && !matchCampaign) {
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
      planId: '',
      campaignId: ''
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
      planId: t.planId || '',
      campaignId: t.campaignId || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const linkedPlan = plans.find(p => p.id === formData.planId);
      const linkedCampaign = campaigns.find(c => c.id === formData.campaignId);
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

      if (formData.campaignId && linkedCampaign) {
        dataToSave.campaignId = linkedCampaign.id;
        dataToSave.campaignName = linkedCampaign.name;
      } else {
        dataToSave.campaignId = null;
        dataToSave.campaignName = null;
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
        planId: '',
        campaignId: '' 
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

        {/* Sub-tab Switcher: Tổng quan & Thống kê vs Sổ Thu Chi vs Dự Toán Chi Theo Kế Hoạch */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-2xl shrink-0 self-start sm:self-auto shadow-inner overflow-x-auto max-w-full">
          <button
            onClick={() => setSubTab('overview')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
              subTab === 'overview' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Tổng quan & Thống kê</span>
          </button>
          <button
            onClick={() => setSubTab('actual')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
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
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap",
              subTab === 'budget' 
                ? "bg-white text-indigo-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Wallet className="w-4 h-4" />
            <span>Dự toán theo kế hoạch</span>
            {totalPlanBudget > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-black bg-indigo-100 text-indigo-700 rounded-md">
                {formatCurrency(totalPlanBudget)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subtab Content */}
      {subTab === 'overview' ? (
        <TransactionOverview
          transactions={transactions}
          plans={plans}
          onOpenAddTransaction={handleOpenAdd}
          onSwitchToActualList={(categoryFilter) => {
            if (categoryFilter) {
              setFilterCategory(categoryFilter);
            }
            setSubTab('actual');
          }}
        />
      ) : subTab === 'budget' ? (
        <PlanBudgetManager plans={plans} transactions={transactions} />
      ) : (
        <div className="space-y-4 md:space-y-6">
          {/* Quick Cashflow Summary Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            <div className="bg-white p-2.5 sm:p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
              <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5 sm:mb-1 truncate">
                Tổng thu
              </span>
              <p className="text-xs sm:text-base md:text-xl font-black text-emerald-600 truncate break-words">
                +{formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="bg-white p-2.5 sm:p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
              <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5 sm:mb-1 truncate">
                Tổng chi
              </span>
              <p className="text-xs sm:text-base md:text-xl font-black text-red-600 truncate break-words">
                -{formatCurrency(totalExpense)}
              </p>
            </div>
            <div className="bg-white p-2.5 sm:p-3.5 md:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
              <span className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5 sm:mb-1 truncate">
                Số dư
              </span>
              <p className={cn(
                "text-xs sm:text-base md:text-xl font-black truncate break-words",
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
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Danh sách giao dịch thực tế</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  {isFiltered ? `${filteredTransactions.length} / ${transactions.length}` : `${transactions.length}`}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Các khoản thu chi tiền mặt, chuyển khoản đã thực hiện</p>
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setSubTab('overview')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95"
              >
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                <span>Thống kê</span>
              </button>
              <button 
                onClick={handleOpenAdd}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Ghi khoản mới</span>
              </button>
            </div>
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
                  className="w-full pl-9 pr-9 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/60 focus:bg-white min-h-[44px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl shrink-0 w-full sm:w-auto border border-slate-200/50 justify-between">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all min-h-[38px] active:scale-95 touch-manipulation",
                    filterType === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={cn(
                    "flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 min-h-[38px] active:scale-95 touch-manipulation",
                    filterType === 'income' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-500 hover:text-emerald-700"
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Thu</span>
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={cn(
                    "flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 min-h-[38px] active:scale-95 touch-manipulation",
                    filterType === 'expense' ? "bg-red-600 text-white shadow-xs" : "text-slate-500 hover:text-red-700"
                  )}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
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
                    "w-full px-3 py-2.5 rounded-xl border text-base sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white min-h-[44px]",
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
                    "w-full px-3 py-2.5 rounded-xl border text-base sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white min-h-[44px]",
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
                    "w-full px-3 py-2.5 rounded-xl border text-base sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white min-h-[44px]",
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs animate-in fade-in duration-200">
                <span className="font-bold text-indigo-900 shrink-0 flex items-center gap-1">
                  <CalendarClock className="w-4 h-4 text-indigo-600" />
                  Chọn mốc ngày:
                </span>
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium text-[11px]">Từ ngày:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 font-medium text-[11px]">Đến ngày:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                    />
                  </div>
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline self-end sm:self-center py-1 min-h-[36px] flex items-center"
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
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[38px] active:scale-95 touch-manipulation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa bộ lọc</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Mobile View: Transaction Cards list */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTransactions.map((t) => (
                <div key={t.id} className="p-3.5 sm:p-4 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
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
                    {/* Action buttons on Mobile with touch ergonomics */}
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleOpenEdit(t)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors min-h-[36px] active:scale-95 touch-manipulation"
                        title="Chỉnh sửa giao dịch"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button 
                        onClick={() => setDeletingTransaction(t)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95 touch-manipulation"
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{t.category}</p>
                      {t.description && <p className="text-xs text-slate-500 mt-0.5 break-words">{t.description}</p>}
                      {t.planTitle && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 mr-1 border border-indigo-100">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Kế hoạch: {t.planTitle}</span>
                        </span>
                      )}
                      {t.campaignName && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-100">
                          <Sprout className="w-2.5 h-2.5" />
                          <span>Vụ: {t.campaignName}</span>
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm sm:text-base font-extrabold shrink-0 text-right",
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
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 mr-1.5 border border-indigo-100">
                              <Calendar className="w-3 h-3" />
                              <span>Thuộc: {t.planTitle}</span>
                            </span>
                          )}
                          {t.campaignName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-100">
                              <Sprout className="w-3 h-3" />
                              <span>Vụ: {t.campaignName}</span>
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
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Loại giao dịch</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'income'})}
                      className={cn(
                        "py-2.5 rounded-xl text-xs md:text-sm font-bold border-2 transition-all min-h-[44px] active:scale-95 touch-manipulation", 
                        formData.type === 'income' ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-extrabold" : "border-slate-100 text-slate-400"
                      )}
                    >
                      Thu tiền
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'expense'})}
                      className={cn(
                        "py-2.5 rounded-xl text-xs md:text-sm font-bold border-2 transition-all min-h-[44px] active:scale-95 touch-manipulation", 
                        formData.type === 'expense' ? "border-red-500 bg-red-50 text-red-700 font-extrabold" : "border-slate-100 text-slate-400"
                      )}
                    >
                      Chi tiền
                    </button>
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
                      className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium min-h-[44px]"
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

                {/* Campaign Linkage (Optional) */}
                {campaigns && campaigns.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1.5">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Thuộc Chiến dịch / Đợt vào nấm (Tùy chọn)</span>
                    </label>
                    <select
                      value={formData.campaignId}
                      onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium min-h-[44px]"
                    >
                      <option value="">-- Không gắn vào đợt nào (Thu chi chung) --</option>
                      {campaigns.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.variety ? `(${c.variety})` : ''} {c.location ? `— ${c.location}` : ''}
                        </option>
                      ))}
                    </select>
                    {formData.campaignId && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <Sprout className="w-3 h-3 text-emerald-600" />
                        Khoản này sẽ được hạch toán trực tiếp vào đợt nấm đã chọn.
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
                    inputMode="numeric"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
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
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-2 font-medium min-h-[44px]"
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
                              "group inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all border cursor-pointer select-none min-h-[32px] active:scale-95 touch-manipulation",
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
                                  "opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 -mr-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center",
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
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Ngày giao dịch</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 min-h-[48px] active:scale-95 touch-manipulation"
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
                  <a 
                    href={`tel:${order.customerPhone}`}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50/70 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-100 mt-1.5 active:scale-95 touch-manipulation w-fit min-h-[36px]"
                    title="Bấm để gọi khách hàng"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{order.customerPhone} (Gọi)</span>
                  </a>
                )}
                <p className="text-xs md:text-sm text-slate-600 mt-2.5 line-clamp-3 bg-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-100">{order.items}</p>
              </div>
              <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-base md:text-lg font-black text-indigo-600">{formatCurrency(order.totalAmount)}</p>
                <select 
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="text-xs font-bold bg-slate-100 border border-slate-200/60 rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-indigo-500 cursor-pointer text-slate-700 hover:bg-slate-200 transition-colors min-h-[40px]"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-slate-900">Tạo đơn hàng mới</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center">
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
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số điện thoại liên hệ</label>
                  <input 
                    type="tel" 
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="VD: 0987654321"
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Thời gian đơn hàng</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.orderTime}
                    onChange={(e) => setFormData({...formData, orderTime: e.target.value})}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tổng tiền (VNĐ)</label>
                  <input 
                    type="number" 
                    inputMode="numeric"
                    required
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({...formData, totalAmount: Number(e.target.value)})}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Danh sách mặt hàng</label>
                  <textarea 
                    rows={3}
                    required
                    value={formData.items}
                    onChange={(e) => setFormData({...formData, items: e.target.value})}
                    placeholder="VD: 20kg nấm sò, 10 bịch phôi giống..."
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
                <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100 min-h-[48px] active:scale-95 touch-manipulation">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-slate-900">Thêm nhân viên mới</h3>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
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
                    placeholder="VD: Nguyễn Văn B"
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Vị trí / Vai trò</label>
                  <input 
                    type="text" 
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    placeholder="VD: Kỹ thuật đóng bịch, Thu hoạch..."
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Số điện thoại</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="VD: 0912345678"
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mức lương (VNĐ)</label>
                  <input 
                    type="number" 
                    inputMode="numeric"
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all mt-4 shadow-lg shadow-indigo-100 min-h-[48px] active:scale-95 touch-manipulation"
                >
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
  const [campaigns, setCampaigns] = useState<any[]>([]);

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
    const unsubC = subscribeCampaigns(setCampaigns);

    return () => {
      unsubT();
      unsubO();
      unsubW();
      unsubP();
      unsubC();
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
      <div className="flex md:hidden items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-100 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <img 
            src="/app-icon.png" 
            alt="Trại Nấm Michfarm" 
            className="w-7 h-7 rounded-lg shadow-xs shrink-0 object-cover border border-emerald-100" 
            referrerPolicy="no-referrer" 
          />
          <span className="text-base font-black text-emerald-800 tracking-tight">Trại Nấm Michfarm</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PWAInstallButton variant="compact" />
          {user && (
            <div className="flex items-center gap-1">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-7 h-7 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
              <button 
                onClick={() => signOut(auth)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-xl transition-all"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom,0.5rem))] md:pb-8">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard transactions={transactions} orders={orders} workers={workers} plans={plans} campaigns={campaigns} onNavigate={setActiveTab} />}
              {activeTab === 'campaigns' && <Campaigns campaigns={campaigns} plans={plans} transactions={transactions} onNavigateTab={setActiveTab} />}
              {activeTab === 'plans' && <Plans plans={plans} campaigns={campaigns} />}
              {activeTab === 'transactions' && <Transactions transactions={transactions} plans={plans} campaigns={campaigns} />}
              {activeTab === 'orders' && <Orders orders={orders} />}
              {activeTab === 'workers' && <Workers workers={workers} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] z-40 justify-around items-center shadow-[0_-4px_16px_rgba(0,0,0,0.06)] rounded-t-2xl">
        {[
          { id: 'campaigns', label: 'Chiến dịch', icon: Sprout },
          { id: 'plans', label: 'Kế hoạch', icon: CalendarDays },
          { id: 'transactions', label: 'Thu chi', icon: Receipt },
          { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { id: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
          { id: 'workers', label: 'Nhân sự', icon: Users },
        ].map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all duration-200 text-center min-w-[48px] active:scale-95 touch-manipulation select-none",
                isActive 
                  ? "text-emerald-700 font-black bg-emerald-50/90 shadow-2xs" 
                  : "text-slate-500 font-semibold hover:text-slate-800"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive && "scale-110 text-emerald-600")} />
              <span className="text-[9px] tracking-tight truncate max-w-[50px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
