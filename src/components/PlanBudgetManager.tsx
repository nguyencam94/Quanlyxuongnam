import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  ArrowUpRight, 
  TrendingDown, 
  Wallet, 
  Receipt, 
  Layers, 
  X, 
  Check, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn, formatCurrency } from '../lib/utils';
import { Plan, BudgetItem, Transaction } from '../types';
import { addTransaction, updatePlan, addPlan } from '../services/firestore';

interface PlanBudgetManagerProps {
  plans: Plan[];
  transactions: Transaction[];
  onOpenAddPlan?: () => void;
}

export const BUDGET_CATEGORIES = [
  { id: 'seed', label: 'Phôi giống & Meo nấm', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'material', label: 'Nguyên vật liệu & Giá thể', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'packaging', label: 'Bao bì & Đóng gói', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'equipment', label: 'Thiết bị & Năng lượng', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'labor', label: 'Nhân công thời vụ', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'transport', label: 'Vận chuyển & Giao hàng', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'other', label: 'Chi phí khác', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export const PlanBudgetManager: React.FC<PlanBudgetManagerProps> = ({ plans, transactions }) => {
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overbudget'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal states
  const [showAddBudgetModal, setShowAddBudgetModal] = useState<boolean>(false);
  const [selectedPlanForBudget, setSelectedPlanForBudget] = useState<string>('');
  const [isCreatingNewPlan, setIsCreatingNewPlan] = useState<boolean>(false);
  const [newPlanTitle, setNewPlanTitle] = useState<string>('');
  
  const [editingItem, setEditingItem] = useState<{ planId: string; item: BudgetItem } | null>(null);
  const [budgetFormData, setBudgetFormData] = useState({
    title: '',
    amount: 0,
    category: BUDGET_CATEGORIES[0].label,
    notes: '',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Modal to execute payment (Ghi nhận chi thực tế)
  const [payingItem, setPayingItem] = useState<{ plan: Plan; item: BudgetItem } | null>(null);
  const [payFormData, setPayFormData] = useState({
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const [expandedPlanIds, setExpandedPlanIds] = useState<Record<string, boolean>>({});

  const toggleExpandPlan = (planId: string) => {
    setExpandedPlanIds(prev => ({
      ...prev,
      [planId]: prev[planId] === undefined ? false : !prev[planId]
    }));
  };

  // Helper to get plan start date
  const getPlanDate = (plan: Plan): Date | null => {
    if (!plan?.startDate) return null;
    return plan.startDate?.toDate ? plan.startDate.toDate() : new Date(plan.startDate);
  };

  // Calculate stats for a single plan
  const getPlanBudgetStats = (plan: Plan) => {
    const items = plan.budgetItems || [];
    const totalEstimated = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    
    // Transactions directly linked to this plan
    const linkedExpenses = transactions.filter(t => t.type === 'expense' && t.planId === plan.id);
    const linkedAmount = linkedExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Items marked paid but not via linked transaction
    const directPaidAmount = items
      .filter(i => i.isPaid && !linkedExpenses.some(t => t.budgetItemId === i.id))
      .reduce((sum, i) => sum + (Number(i.actualAmount || i.amount) || 0), 0);

    const totalActual = linkedAmount + directPaidAmount;
    const remaining = totalEstimated - totalActual;
    const percent = totalEstimated > 0 ? Math.min(Math.round((totalActual / totalEstimated) * 100), 999) : 0;

    return {
      totalEstimated,
      totalActual,
      remaining,
      percent,
      itemCount: items.length,
      paidCount: items.filter(i => i.isPaid).length,
      isOver: totalActual > totalEstimated && totalEstimated > 0
    };
  };

  // Overall statistics across all plans
  const overallStats = plans.reduce((acc, plan) => {
    const stats = getPlanBudgetStats(plan);
    return {
      totalEstimated: acc.totalEstimated + stats.totalEstimated,
      totalActual: acc.totalActual + stats.totalActual,
      totalPlansWithBudget: acc.totalPlansWithBudget + (stats.itemCount > 0 ? 1 : 0),
      totalItems: acc.totalItems + stats.itemCount,
      totalPaidItems: acc.totalPaidItems + stats.paidCount
    };
  }, {
    totalEstimated: 0,
    totalActual: 0,
    totalPlansWithBudget: 0,
    totalItems: 0,
    totalPaidItems: 0
  });

  const overallRemaining = overallStats.totalEstimated - overallStats.totalActual;
  const overallPercent = overallStats.totalEstimated > 0 
    ? Math.round((overallStats.totalActual / overallStats.totalEstimated) * 100) 
    : 0;

  // Filter plans
  const filteredPlans = plans.filter(plan => {
    if (selectedPlanFilter !== 'all' && plan.id !== selectedPlanFilter) {
      return false;
    }

    const items = plan.budgetItems || [];
    const stats = getPlanBudgetStats(plan);

    if (statusFilter === 'unpaid') {
      if (!items.some(i => !i.isPaid)) return false;
    } else if (statusFilter === 'paid') {
      if (items.length === 0 || !items.every(i => i.isPaid)) return false;
    } else if (statusFilter === 'overbudget') {
      if (!stats.isOver) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlanTitle = plan.title.toLowerCase().includes(q);
      const matchItems = items.some(i => 
        i.title.toLowerCase().includes(q) || 
        i.category.toLowerCase().includes(q) || 
        (i.notes && i.notes.toLowerCase().includes(q))
      );
      if (!matchPlanTitle && !matchItems) return false;
    }

    return true;
  });

  // Open modal for adding item to plan
  const handleOpenAddBudget = (planId?: string) => {
    if (planId) {
      setSelectedPlanForBudget(planId);
      setIsCreatingNewPlan(false);
    } else if (plans.length > 0) {
      setSelectedPlanForBudget(plans[0].id);
      setIsCreatingNewPlan(false);
    } else {
      setIsCreatingNewPlan(true);
      setSelectedPlanForBudget('');
    }
    setEditingItem(null);
    setBudgetFormData({
      title: '',
      amount: 0,
      category: BUDGET_CATEGORIES[0].label,
      notes: '',
      dueDate: format(new Date(), 'yyyy-MM-dd')
    });
    setShowAddBudgetModal(true);
  };

  // Open modal for editing an existing item
  const handleOpenEditItem = (planId: string, item: BudgetItem) => {
    setEditingItem({ planId, item });
    setSelectedPlanForBudget(planId);
    setIsCreatingNewPlan(false);
    setBudgetFormData({
      title: item.title,
      amount: item.amount,
      category: item.category || BUDGET_CATEGORIES[0].label,
      notes: item.notes || '',
      dueDate: item.paidDate || format(new Date(), 'yyyy-MM-dd')
    });
    setShowAddBudgetModal(true);
  };

  // Save budget item (Add / Edit)
  const handleSaveBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetFormData.title.trim() || budgetFormData.amount <= 0) return;

    try {
      let targetPlanId = selectedPlanForBudget;

      // If user chose to create a new plan alongside this budget
      if (isCreatingNewPlan) {
        if (!newPlanTitle.trim()) return;
        const newPlanRef = await addPlan({
          title: newPlanTitle.trim(),
          description: `Kế hoạch kèm dự toán chi phí: ${budgetFormData.title}`,
          startDate: new Date().toISOString(),
          status: 'todo',
          subtasks: [],
          budgetItems: []
        });
        if (newPlanRef?.id) {
          targetPlanId = newPlanRef.id;
        }
      }

      const currentPlan = plans.find(p => p.id === targetPlanId);
      if (!currentPlan && !isCreatingNewPlan) return;

      const existingItems = currentPlan?.budgetItems || [];

      if (editingItem) {
        // Update item in plan
        const updatedItems = existingItems.map(item => {
          if (item.id === editingItem.item.id) {
            return {
              ...item,
              title: budgetFormData.title,
              amount: Number(budgetFormData.amount),
              category: budgetFormData.category,
              notes: budgetFormData.notes
            };
          }
          return item;
        });
        await updatePlan(targetPlanId, { budgetItems: updatedItems });
      } else {
        // Add new item
        const newItem: BudgetItem = {
          id: `b_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: budgetFormData.title,
          amount: Number(budgetFormData.amount),
          category: budgetFormData.category,
          notes: budgetFormData.notes,
          isPaid: false
        };
        await updatePlan(targetPlanId, { budgetItems: [...existingItems, newItem] });
      }

      setShowAddBudgetModal(false);
      setEditingItem(null);
      setNewPlanTitle('');
    } catch (err) {
      console.error('Lỗi khi lưu khoản dự toán:', err);
    }
  };

  // Delete budget item
  const handleDeleteBudgetItem = async (planId: string, itemId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const updatedItems = (plan.budgetItems || []).filter(item => item.id !== itemId);
    await updatePlan(planId, { budgetItems: updatedItems });
  };

  // Open pay modal
  const handleOpenPayModal = (plan: Plan, item: BudgetItem) => {
    setPayingItem({ plan, item });
    setPayFormData({
      amount: item.amount,
      date: format(new Date(), 'yyyy-MM-dd'),
      notes: `Chi theo kế hoạch: ${plan.title} (${item.title})`
    });
  };

  // Confirm payment: create real Transaction and update budgetItem
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingItem) return;

    try {
      const { plan, item } = payingItem;
      const amountToPay = Number(payFormData.amount);

      // 1. Create real transaction in 'transactions'
      await addTransaction({
        type: 'expense',
        amount: amountToPay,
        category: item.category || 'Chi theo kế hoạch',
        description: payFormData.notes || `Chi theo kế hoạch: ${plan.title} - ${item.title}`,
        date: payFormData.date,
        planId: plan.id,
        planTitle: plan.title,
        budgetItemId: item.id
      });

      // 2. Mark item as paid in Plan's budgetItems
      const updatedItems = (plan.budgetItems || []).map(i => {
        if (i.id === item.id) {
          return {
            ...i,
            isPaid: true,
            actualAmount: amountToPay,
            paidDate: payFormData.date
          };
        }
        return i;
      });

      await updatePlan(plan.id, { budgetItems: updatedItems });

      setPayingItem(null);
    } catch (err) {
      console.error('Lỗi khi ghi nhận chi thực tế:', err);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg md:text-xl font-black text-slate-900">Dự toán chi theo kế hoạch</h3>
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
              Trại Nấm Michfarm
            </span>
          </div>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">
            Lập kế hoạch ngân sách, đối chiếu thực chi và giải ngân trực tiếp vào sổ Thu Chi
          </p>
        </div>

        <button
          onClick={() => handleOpenAddBudget()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-indigo-100 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Lập dự toán mới</span>
        </button>
      </div>

      {/* 2. Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Total Estimated */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng dự toán</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-base md:text-xl font-black text-slate-900 break-words leading-tight">
              {formatCurrency(overallStats.totalEstimated)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Từ {overallStats.totalPlansWithBudget} kế hoạch sản xuất
            </p>
          </div>
        </div>

        {/* Total Actual Spent */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Thực chi đã giải ngân</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-base md:text-xl font-black text-rose-600 break-words leading-tight">
              {formatCurrency(overallStats.totalActual)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Đã thanh toán {overallStats.totalPaidItems}/{overallStats.totalItems} khoản
            </p>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Ngân sách còn lại</span>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              overallRemaining >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className={cn(
              "text-base md:text-xl font-black break-words leading-tight",
              overallRemaining >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {formatCurrency(overallRemaining)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              {overallRemaining >= 0 ? 'Trong hạn mức dự trù' : 'Đã vượt mức dự toán!'}
            </p>
          </div>
        </div>

        {/* Disbursement Progress */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến độ giải ngân</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-base md:text-xl font-black text-slate-900">{overallPercent}%</p>
              <span className="text-[10px] text-slate-400 font-semibold">
                {overallStats.totalPaidItems}/{overallStats.totalItems} hạng mục
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  overallPercent > 100 ? "bg-red-500" : overallPercent >= 80 ? "bg-amber-500" : "bg-indigo-600"
                )}
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo kế hoạch, tên khoản chi, vật tư..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          {/* Plan Selector */}
          <select
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shrink-0 min-h-[44px]"
          >
            <option value="all">Tất cả kế hoạch</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shrink-0 min-h-[44px]"
          >
            <option value="all">Mọi trạng thái chi</option>
            <option value="unpaid">Chưa chi (Dự kiến)</option>
            <option value="paid">Đã giải ngân hết</option>
            <option value="overbudget">Vượt ngân sách</option>
          </select>
        </div>
      </div>

      {/* 4. Plan Budget Cards List */}
      <div className="space-y-4">
        {filteredPlans.map((plan) => {
          const stats = getPlanBudgetStats(plan);
          const items = plan.budgetItems || [];
          const planDate = getPlanDate(plan);
          const isExpanded = expandedPlanIds[plan.id] !== false; // expanded by default

          return (
            <motion.div
              layout
              key={plan.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden hover:border-slate-200 hover:shadow-sm transition-all"
            >
              {/* Card Header: Plan Summary */}
              <div 
                className="p-4 md:p-5 bg-slate-50/50 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => toggleExpandPlan(plan.id)}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 border border-indigo-100">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm md:text-base hover:text-indigo-600 transition-colors truncate">
                        {plan.title}
                      </h4>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold uppercase tracking-wider",
                        plan.status === 'done' ? "bg-emerald-100 text-emerald-700" :
                        plan.status === 'in-progress' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-200 text-slate-700"
                      )}>
                        {plan.status === 'done' ? 'Đã hoàn thành' : plan.status === 'in-progress' ? 'Đang thực hiện' : 'Chờ làm'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      {planDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {format(planDate, 'dd/MM/yyyy')}
                        </span>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-slate-600">
                        {items.length} khoản mục dự toán
                      </span>
                      {stats.isOver && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full font-bold text-[10px]">
                          Vượt dự toán {formatCurrency(Math.abs(stats.remaining))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plan Stats & Toggle */}
                <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-slate-400">Dự toán:</span>
                      <span className="text-sm md:text-base font-black text-slate-900">{formatCurrency(stats.totalEstimated)}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end text-xs">
                      <span className="text-slate-400">Thực chi:</span>
                      <span className={cn("font-bold", stats.isOver ? "text-red-600" : "text-emerald-600")}>
                        {formatCurrency(stats.totalActual)} ({stats.percent}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenAddBudget(plan.id)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-bold text-xs flex items-center gap-1"
                      title="Thêm khoản mục dự toán cho kế hoạch này"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Thêm khoản chi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpandPlan(plan.id)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar under header */}
              <div className="w-full bg-slate-100 h-1 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    stats.isOver ? "bg-red-500" : stats.percent >= 80 ? "bg-amber-500" : "bg-indigo-600"
                  )}
                  style={{ width: `${Math.min(stats.percent, 100)}%` }}
                />
              </div>

              {/* Itemized Budget List */}
              {isExpanded && (
                <div className="p-3 md:p-5">
                  {items.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {items.map((item) => {
                        const isPaid = item.isPaid;
                        return (
                          <div 
                            key={item.id} 
                            className="p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                              )}>
                                {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={cn(
                                    "font-bold text-xs md:text-sm truncate",
                                    isPaid ? "text-slate-600" : "text-slate-900"
                                  )}>
                                    {item.title}
                                  </p>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                                    {item.category}
                                  </span>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                    isPaid 
                                      ? "bg-emerald-100 text-emerald-700" 
                                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  )}>
                                    {isPaid ? 'Đã chi thực tế' : 'Dự kiến'}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.notes}</p>
                                )}
                              </div>
                            </div>

                            {/* Amounts & Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pl-10 sm:pl-0">
                              <div className="text-right">
                                <p className="text-xs md:text-sm font-black text-slate-900">
                                  {formatCurrency(item.amount)}
                                </p>
                                {isPaid && item.actualAmount !== undefined && item.actualAmount !== item.amount && (
                                  <p className="text-[10px] font-semibold text-rose-500">
                                    Thực chi: {formatCurrency(item.actualAmount)}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Quick Pay Button: convert to real transaction */}
                                {!isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayModal(plan, item)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 min-h-[36px] active:scale-95 touch-manipulation"
                                    title="Ghi nhận chi thực tế vào sổ Thu Chi"
                                  >
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    <span>Chi thực tế</span>
                                  </button>
                                ) : (
                                  <span className="px-2.5 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl flex items-center gap-1 min-h-[36px]">
                                    <Check className="w-3.5 h-3.5" /> Đã chi
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(plan.id, item)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95 touch-manipulation"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBudgetItem(plan.id, item.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95 touch-manipulation"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <p className="text-xs text-slate-500 font-medium">Kế hoạch này chưa có khoản dự toán nào.</p>
                      <button
                        type="button"
                        onClick={() => handleOpenAddBudget(plan.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        <Plus className="w-3.5 h-3.5" /> Lập dự toán chi cho kế hoạch này ngay
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {filteredPlans.length === 0 && (
          <div className="bg-white p-8 md:p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">Chưa có dự toán chi nào</h4>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Hãy lập dự toán các khoản chi phí cho các đợt cấy giống, mua giá thể, bao bì, nhân công hoặc bảo dưỡng trại nấm.
            </p>
            <button
              onClick={() => handleOpenAddBudget()}
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              <span>Lập dự toán chi đầu tiên</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Modal: Add or Edit Budget Item */}
      <AnimatePresence>
        {showAddBudgetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900">
                    {editingItem ? 'Chỉnh sửa khoản dự toán' : 'Lập khoản dự toán chi mới'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Dự trù kinh phí thực hiện kế hoạch sản xuất</p>
                </div>
                <button
                  onClick={() => setShowAddBudgetModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBudgetItem} className="space-y-4">
                {/* Plan Selection */}
                {!editingItem && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Áp dụng cho Kế hoạch
                    </label>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewPlan(false)}
                        className={cn(
                          "py-2.5 text-xs font-bold rounded-xl border transition-all min-h-[42px] active:scale-95 touch-manipulation",
                          !isCreatingNewPlan ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold" : "border-slate-200 text-slate-500"
                        )}
                      >
                        Chọn kế hoạch có sẵn
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewPlan(true)}
                        className={cn(
                          "py-2.5 text-xs font-bold rounded-xl border transition-all min-h-[42px] active:scale-95 touch-manipulation",
                          isCreatingNewPlan ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold" : "border-slate-200 text-slate-500"
                        )}
                      >
                        + Tạo kế hoạch mới
                      </button>
                    </div>

                    {!isCreatingNewPlan ? (
                      <select
                        value={selectedPlanForBudget}
                        onChange={(e) => setSelectedPlanForBudget(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium min-h-[44px]"
                      >
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="VD: Cấy meo giống nấm sò trắng đợt 3..."
                        value={newPlanTitle}
                        onChange={(e) => setNewPlanTitle(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
                      />
                    )}
                  </div>
                )}

                {/* Item Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Tên khoản chi dự kiến <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Mua 1.000 bịch phôi nấm bào ngư xám..."
                    value={budgetFormData.title}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
                  />
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Số tiền dự toán (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs font-black text-indigo-600">
                      {formatCurrency(budgetFormData.amount || 0)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    inputMode="numeric"
                    required
                    value={budgetFormData.amount || ''}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-h-[44px]"
                    placeholder="Nhập số tiền..."
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Phân loại chi phí
                  </label>
                  <select
                    value={budgetFormData.category}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium min-h-[44px]"
                  >
                    {BUDGET_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Ghi chú / Đơn vị cung cấp
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú thêm về nhà cung cấp, số lượng, điều kiện thanh toán..."
                    value={budgetFormData.notes}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>

                {/* Submit button */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBudgetModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md shadow-indigo-100 min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    {editingItem ? 'Cập nhật' : 'Lưu dự toán'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Modal: Confirm Payment (Ghi nhận chi thực tế) */}
      <AnimatePresence>
        {payingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 sm:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Ghi nhận chi thực tế</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tạo khoản Chi vào Sổ Thu Chi & cập nhật dự toán</p>
                </div>
                <button
                  onClick={() => setPayingItem(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary info box */}
              <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-2xl mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Kế hoạch:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{payingItem.plan.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khoản chi:</span>
                  <span className="font-bold text-slate-800">{payingItem.item.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mức dự toán:</span>
                  <span className="font-bold text-indigo-700">{formatCurrency(payingItem.item.amount)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmPayment} className="space-y-4">
                {/* Actual Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Số tiền chi thực tế (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs font-black text-emerald-600">
                      {formatCurrency(payFormData.amount || 0)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    inputMode="numeric"
                    required
                    value={payFormData.amount || ''}
                    onChange={(e) => setPayFormData({ ...payFormData, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px]"
                  />
                  {payFormData.amount !== payingItem.item.amount && (
                    <p className={cn(
                      "text-[10px] font-semibold mt-1",
                      payFormData.amount > payingItem.item.amount ? "text-red-500" : "text-emerald-600"
                    )}>
                      {payFormData.amount > payingItem.item.amount
                        ? `Vượt dự toán ${formatCurrency(payFormData.amount - payingItem.item.amount)}`
                        : `Tiết kiệm ${formatCurrency(payingItem.item.amount - payFormData.amount)} so với dự toán`}
                    </p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Ngày thanh toán
                  </label>
                  <input
                    type="date"
                    required
                    value={payFormData.date}
                    onChange={(e) => setPayFormData({ ...payFormData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px]"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Ghi chú vào Sổ Thu Chi
                  </label>
                  <input
                    type="text"
                    value={payFormData.notes}
                    onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px]"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayingItem(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 min-h-[48px] active:scale-95 touch-manipulation"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận chi</span>
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
