import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Layers, 
  Plus, 
  Receipt, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Info,
  CalendarDays,
  Percent,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
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
  Pie, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subWeeks, 
  addWeeks, 
  subMonths, 
  addMonths, 
  eachDayOfInterval, 
  isSameDay, 
  isWithinInterval, 
  parseISO,
  isToday
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn, formatCurrency } from '../lib/utils';
import { Transaction, Plan } from '../types';

interface TransactionOverviewProps {
  transactions: Transaction[];
  plans?: Plan[];
  onOpenAddTransaction: () => void;
  onSwitchToActualList: (categoryFilter?: string) => void;
}

type TimePeriod = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'today' | 'all' | 'custom';

const PALETTE = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#d946ef', // Fuchsia
  '#64748b', // Slate
];

const parseTxDate = (val: any): Date | null => {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const TransactionOverview: React.FC<TransactionOverviewProps> = ({
  transactions,
  plans = [],
  onOpenAddTransaction,
  onSwitchToActualList
}) => {
  const [period, setPeriod] = useState<TimePeriod>('this_week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  
  // Weekly / Monthly stepper offset (0 is current, -1 is 1 week ago, +1 is next week, etc.)
  const [periodOffset, setPeriodOffset] = useState<number>(0);

  // Category breakdown mode: expense vs income
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [chartViewType, setChartViewType] = useState<'bar' | 'area'>('bar');

  // Calculate current date range based on period and offset
  const { startDate, endDate, dateRangeLabel, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();

    if (period === 'today') {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + periodOffset);
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);

      return {
        startDate: start,
        endDate: end,
        dateRangeLabel: isToday(start) ? `Hôm nay (${format(start, 'dd/MM/yyyy')})` : format(start, 'dd/MM/yyyy'),
        prevStartDate: prevStart,
        prevEndDate: prevEnd
      };
    }

    if (period === 'this_week' || period === 'last_week') {
      const baseDate = period === 'last_week' 
        ? subWeeks(now, 1 + Math.abs(periodOffset)) 
        : addWeeks(now, periodOffset);

      const start = startOfWeek(baseDate, { weekStartsOn: 1 });
      const end = endOfWeek(baseDate, { weekStartsOn: 1 });
      
      const prevStart = subWeeks(start, 1);
      const prevEnd = subWeeks(end, 1);

      return {
        startDate: start,
        endDate: end,
        dateRangeLabel: `Tuần từ ${format(start, 'dd/MM')} đến ${format(end, 'dd/MM/yyyy')}`,
        prevStartDate: prevStart,
        prevEndDate: prevEnd
      };
    }

    if (period === 'this_month' || period === 'last_month') {
      const baseDate = period === 'last_month' 
        ? subMonths(now, 1 + Math.abs(periodOffset)) 
        : addMonths(now, periodOffset);

      const start = startOfMonth(baseDate);
      const end = endOfMonth(baseDate);

      const prevStart = subMonths(start, 1);
      const prevEnd = subMonths(end, 1);

      return {
        startDate: start,
        endDate: end,
        dateRangeLabel: `Tháng ${format(start, 'MM/yyyy')} (${format(start, 'dd/MM')} - ${format(end, 'dd/MM')})`,
        prevStartDate: prevStart,
        prevEndDate: prevEnd
      };
    }

    if (period === 'custom') {
      const start = customStart ? new Date(customStart + 'T00:00:00') : null;
      const end = customEnd ? new Date(customEnd + 'T23:59:59') : null;

      let label = 'Tùy chọn khoảng ngày';
      if (start && end) {
        label = `Từ ${format(start, 'dd/MM/yyyy')} đến ${format(end, 'dd/MM/yyyy')}`;
      } else if (start) {
        label = `Từ ngày ${format(start, 'dd/MM/yyyy')}`;
      } else if (end) {
        label = `Đến ngày ${format(end, 'dd/MM/yyyy')}`;
      }

      return {
        startDate: start,
        endDate: end,
        dateRangeLabel: label,
        prevStartDate: null,
        prevEndDate: null
      };
    }

    // Default 'all'
    return {
      startDate: null,
      endDate: null,
      dateRangeLabel: 'Toàn bộ thời gian hoạt động',
      prevStartDate: null,
      prevEndDate: null
    };
  }, [period, periodOffset, customStart, customEnd]);

  // Filter transactions in current period
  const periodTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = parseTxDate(t.date);
      if (!tDate) return false;

      if (!startDate && !endDate) return true;
      if (startDate && endDate) {
        return isWithinInterval(tDate, { start: startDate, end: endDate });
      }
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  }, [transactions, startDate, endDate]);

  // Filter transactions in previous period for comparison
  const prevPeriodTransactions = useMemo(() => {
    if (!prevStartDate || !prevEndDate) return [];
    return transactions.filter(t => {
      const tDate = parseTxDate(t.date);
      if (!tDate) return false;
      return isWithinInterval(tDate, { start: prevStartDate, end: prevEndDate });
    });
  }, [transactions, prevStartDate, prevEndDate]);

  // Totals for current period
  const totalIncome = useMemo(() => {
    return periodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [periodTransactions]);

  const totalExpense = useMemo(() => {
    return periodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [periodTransactions]);

  const netBalance = totalIncome - totalExpense;
  const incomeCount = periodTransactions.filter(t => t.type === 'income').length;
  const expenseCount = periodTransactions.filter(t => t.type === 'expense').length;

  // Totals for previous period
  const prevTotalIncome = useMemo(() => {
    return prevPeriodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [prevPeriodTransactions]);

  const prevTotalExpense = useMemo(() => {
    return prevPeriodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [prevPeriodTransactions]);

  // Growth percentages
  const incomeGrowth = useMemo(() => {
    if (prevTotalIncome === 0) return totalIncome > 0 ? 100 : 0;
    return Math.round(((totalIncome - prevTotalIncome) / prevTotalIncome) * 100);
  }, [totalIncome, prevTotalIncome]);

  const expenseGrowth = useMemo(() => {
    if (prevTotalExpense === 0) return totalExpense > 0 ? 100 : 0;
    return Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100);
  }, [totalExpense, prevTotalExpense]);

  // Average per day in period
  const daysInPeriod = useMemo(() => {
    if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    return 30;
  }, [startDate, endDate]);

  const avgExpensePerDay = totalExpense / daysInPeriod;
  const avgIncomePerDay = totalIncome / daysInPeriod;

  // Timeline breakdown data for Charts
  const timelineChartData = useMemo(() => {
    if ((period === 'this_week' || period === 'last_week') && startDate && endDate) {
      // 7 days of the week: Thứ 2 -> Chủ Nhật
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return days.map(d => {
        const dayStr = format(d, 'yyyy-MM-dd');
        const dayLabel = format(d, 'EEEE (dd/MM)', { locale: vi });
        const shortLabel = format(d, 'EE dd', { locale: vi });

        const dayTxs = periodTransactions.filter(t => {
          const tDate = parseTxDate(t.date);
          return tDate ? isSameDay(tDate, d) : false;
        });

        const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

        return {
          key: dayStr,
          label: shortLabel,
          fullLabel: dayLabel,
          Thu: income,
          Chi: expense,
          ChenhLech: income - expense
        };
      });
    }

    if ((period === 'this_month' || period === 'last_month') && startDate && endDate) {
      // Group by days of month
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      return days.map(d => {
        const dayStr = format(d, 'yyyy-MM-dd');
        const dayTxs = periodTransactions.filter(t => {
          const tDate = parseTxDate(t.date);
          return tDate ? isSameDay(tDate, d) : false;
        });

        const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

        return {
          key: dayStr,
          label: format(d, 'dd/MM'),
          fullLabel: format(d, 'dd/MM/yyyy'),
          Thu: income,
          Chi: expense,
          ChenhLech: income - expense
        };
      });
    }

    // Default or All time: group by months
    const monthGroups: Record<string, { income: number; expense: number; label: string }> = {};
    periodTransactions.forEach(t => {
      const tDate = parseTxDate(t.date);
      if (!tDate) return;
      const key = format(tDate, 'yyyy-MM');
      const label = format(tDate, 'MM/yyyy');
      if (!monthGroups[key]) {
        monthGroups[key] = { income: 0, expense: 0, label };
      }
      if (t.type === 'income') {
        monthGroups[key].income += Number(t.amount) || 0;
      } else {
        monthGroups[key].expense += Number(t.amount) || 0;
      }
    });

    const sortedKeys = Object.keys(monthGroups).sort();
    if (sortedKeys.length === 0) {
      return [{ key: 'none', label: 'Chưa có dữ liệu', Thu: 0, Chi: 0, ChenhLech: 0 }];
    }

    return sortedKeys.map(k => ({
      key: k,
      label: monthGroups[k].label,
      fullLabel: `Tháng ${monthGroups[k].label}`,
      Thu: monthGroups[k].income,
      Chi: monthGroups[k].expense,
      ChenhLech: monthGroups[k].income - monthGroups[k].expense
    }));
  }, [period, startDate, endDate, periodTransactions]);

  // Category breakdown calculations
  const categoryStats = useMemo(() => {
    const targetType = categoryType;
    const filteredTxs = periodTransactions.filter(t => t.type === targetType);
    const totalAmount = targetType === 'income' ? totalIncome : totalExpense;

    const map: Record<string, {
      category: string;
      total: number;
      count: number;
      transactions: Transaction[];
    }> = {};

    filteredTxs.forEach(t => {
      const cat = (t.category && t.category.trim()) ? t.category.trim() : 'Chưa phân loại';
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          total: 0,
          count: 0,
          transactions: []
        };
      }
      map[cat].total += Number(t.amount) || 0;
      map[cat].count += 1;
      map[cat].transactions.push(t);
    });

    const list = Object.values(map)
      .map((item, index) => {
        const percentage = totalAmount > 0 ? (item.total / totalAmount) * 100 : 0;
        return {
          ...item,
          percentage: Math.round(percentage * 10) / 10,
          color: PALETTE[index % PALETTE.length],
          transactions: item.transactions.sort((a, b) => {
            const da = parseTxDate(a.date)?.getTime() || 0;
            const db = parseTxDate(b.date)?.getTime() || 0;
            return db - da;
          })
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      items: list,
      totalAmount,
      totalCount: filteredTxs.length
    };
  }, [categoryType, periodTransactions, totalIncome, totalExpense]);

  // Filtered categories by search
  const visibleCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoryStats.items;
    const q = categorySearchQuery.toLowerCase().trim();
    return categoryStats.items.filter(c => c.category.toLowerCase().includes(q));
  }, [categoryStats.items, categorySearchQuery]);

  // Donut chart data
  const pieChartData = useMemo(() => {
    if (categoryStats.items.length === 0) return [];
    // Show top 6, rest as "Hạng mục khác"
    if (categoryStats.items.length <= 6) {
      return categoryStats.items.map(item => ({
        name: item.category,
        value: item.total,
        percentage: item.percentage,
        color: item.color
      }));
    }

    const top5 = categoryStats.items.slice(0, 5).map(item => ({
      name: item.category,
      value: item.total,
      percentage: item.percentage,
      color: item.color
    }));

    const otherTotal = categoryStats.items.slice(5).reduce((s, i) => s + i.total, 0);
    const otherPct = categoryStats.totalAmount > 0 ? Math.round((otherTotal / categoryStats.totalAmount) * 1000) / 10 : 0;

    top5.push({
      name: 'Các hạng mục khác',
      value: otherTotal,
      percentage: otherPct,
      color: '#94a3b8'
    });

    return top5;
  }, [categoryStats]);

  // Top spending / earning category
  const topCategory = categoryStats.items[0];

  // Highest spending day in timeline
  const highestDay = useMemo(() => {
    if (!timelineChartData || timelineChartData.length === 0) return null;
    let max = timelineChartData[0];
    timelineChartData.forEach(d => {
      if ((d.Chi || 0) > (max.Chi || 0)) {
        max = d;
      }
    });
    return max && max.Chi > 0 ? max : null;
  }, [timelineChartData]);

  // Plans correlation in this period
  const planExpenditure = useMemo(() => {
    const planMap: Record<string, { planId: string; title: string; spent: number; count: number }> = {};
    periodTransactions.filter(t => t.type === 'expense' && t.planId).forEach(t => {
      const pid = t.planId!;
      const title = t.planTitle || plans.find(p => p.id === pid)?.title || 'Kế hoạch đã xóa';
      if (!planMap[pid]) {
        planMap[pid] = { planId: pid, title, spent: 0, count: 0 };
      }
      planMap[pid].spent += Number(t.amount) || 0;
      planMap[pid].count += 1;
    });
    return Object.values(planMap).sort((a, b) => b.spent - a.spent);
  }, [periodTransactions, plans]);

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
    setPeriodOffset(0);
  };

  const handlePrevPeriod = () => {
    setPeriodOffset(prev => prev - 1);
  };

  const handleNextPeriod = () => {
    setPeriodOffset(prev => prev + 1);
  };

  const handleResetOffset = () => {
    setPeriodOffset(0);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Toolbar: Period Selector & Quick Actions */}
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                Thống Kê Thu Chi & Hạng Mục
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {periodTransactions.length} giao dịch trong kỳ
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-bold text-slate-700">{dateRangeLabel}</span>
              {periodOffset !== 0 && (
                <button
                  onClick={handleResetOffset}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-bold ml-1"
                >
                  (Về hiện tại)
                </button>
              )}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={onOpenAddTransaction}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-md shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi khoản mới</span>
            </button>
            <button
              onClick={() => onSwitchToActualList()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs md:text-sm font-bold transition-all"
            >
              <Receipt className="w-4 h-4 text-slate-500" />
              <span>Xem sổ giao dịch</span>
            </button>
          </div>
        </div>

        {/* Time Selector Pills & Navigator */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => handlePeriodChange('this_week')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'this_week'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tuần này
            </button>
            <button
              onClick={() => handlePeriodChange('last_week')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'last_week'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tuần trước
            </button>
            <button
              onClick={() => handlePeriodChange('this_month')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'this_month'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tháng này
            </button>
            <button
              onClick={() => handlePeriodChange('last_month')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'last_month'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tháng trước
            </button>
            <button
              onClick={() => handlePeriodChange('today')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'today'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Hôm nay
            </button>
            <button
              onClick={() => handlePeriodChange('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'all'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tất cả
            </button>
            <button
              onClick={() => handlePeriodChange('custom')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
                period === 'custom'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Tùy chọn ngày...
            </button>
          </div>

          {/* Stepper Buttons for Weeks/Months */}
          {(period === 'this_week' || period === 'last_week' || period === 'this_month' || period === 'last_month' || period === 'today') && (
            <div className="flex items-center gap-1.5 self-end md:self-auto bg-slate-50 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={handlePrevPeriod}
                title="Kỳ trước"
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold text-slate-600 px-2 select-none">
                {period.includes('week') ? 'Chuyển tuần' : period.includes('month') ? 'Chuyển tháng' : 'Chuyển ngày'}
              </span>
              <button
                onClick={handleNextPeriod}
                title="Kỳ sau"
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">Từ ngày:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">Đến ngày:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            {(customStart || customEnd) && (
              <button
                onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                Xóa ngày
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Key KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {/* Card: Tổng Thu */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-emerald-100 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 opacity-70 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Tổng Thu ({period === 'this_week' ? 'Tuần này' : period === 'this_month' ? 'Tháng này' : 'Kỳ này'})
              </span>
              <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>

            <div>
              <p className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight">
                +{formatCurrency(totalIncome)}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                <span className="text-slate-500 font-medium">{incomeCount} giao dịch thu</span>
                {prevTotalIncome > 0 && (
                  <span className={cn(
                    "font-bold flex items-center gap-0.5",
                    incomeGrowth >= 0 ? "text-emerald-700" : "text-amber-600"
                  )}>
                    {incomeGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {incomeGrowth >= 0 ? `+${incomeGrowth}%` : `${incomeGrowth}%`} so kỳ trước
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card: Tổng Chi */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-red-100 shadow-xs relative overflow-hidden group hover:border-red-300 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -z-0 opacity-70 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Tổng Chi ({period === 'this_week' ? 'Tuần này' : period === 'this_month' ? 'Tháng này' : 'Kỳ này'})
              </span>
              <span className="p-2 bg-red-100 text-red-700 rounded-xl">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>

            <div>
              <p className="text-xl md:text-2xl font-black text-red-600 tracking-tight">
                -{formatCurrency(totalExpense)}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                <span className="text-slate-500 font-medium">{expenseCount} giao dịch chi</span>
                {prevTotalExpense > 0 && (
                  <span className={cn(
                    "font-bold flex items-center gap-0.5",
                    expenseGrowth <= 0 ? "text-emerald-700" : "text-red-600"
                  )}>
                    {expenseGrowth > 0 ? `+${expenseGrowth}%` : `${expenseGrowth}%`} so kỳ trước
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card: Dòng tiền ròng / Thặng dư */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-indigo-100 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-0 opacity-70 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Chênh lệch Thu - Chi
              </span>
              <span className={cn(
                "p-2 rounded-xl",
                netBalance >= 0 ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
              )}>
                <Wallet className="w-4 h-4" />
              </span>
            </div>

            <div>
              <p className={cn(
                "text-xl md:text-2xl font-black tracking-tight",
                netBalance >= 0 ? "text-indigo-600" : "text-amber-600"
              )}>
                {netBalance >= 0 ? `+${formatCurrency(netBalance)}` : formatCurrency(netBalance)}
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                <span className={cn(
                  "font-bold px-2 py-0.5 rounded-md text-[10px]",
                  netBalance >= 0 ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-800"
                )}>
                  {netBalance >= 0 ? 'Dòng tiền dương' : 'Chi vượt thu'}
                </span>
                <span className="text-slate-400 font-medium">
                  {totalIncome > 0 ? `Tỷ lệ chi: ${Math.round((totalExpense / totalIncome) * 100)}%` : '—'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card: Mức chi trung bình mỗi ngày */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -z-0 opacity-70 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Trung bình mỗi ngày
              </span>
              <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                <CalendarDays className="w-4 h-4" />
              </span>
            </div>

            <div>
              <p className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                {formatCurrency(Math.round(avgExpensePerDay))} <span className="text-xs font-semibold text-slate-400">/ngày</span>
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                <span className="text-slate-500 font-medium">Thu TB: {formatCurrency(Math.round(avgIncomePerDay))}/ngày</span>
                <span className="text-slate-400 font-medium">{daysInPeriod} ngày tính</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Timeline Charts: Diễn biến Thu Chi theo ngày/thời gian */}
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Diễn biến Thu & Chi theo thời gian</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              So sánh cột Thu (xanh) và Chi (đỏ) qua từng ngày để nắm bắt cao điểm chi tiêu
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 border border-slate-200/60">
              <button
                onClick={() => setChartViewType('bar')}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all",
                  chartViewType === 'bar' ? "bg-white text-indigo-700 shadow-2xs font-bold" : "hover:text-slate-900"
                )}
              >
                Cột kép
              </button>
              <button
                onClick={() => setChartViewType('area')}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all",
                  chartViewType === 'area' ? "bg-white text-indigo-700 shadow-2xs font-bold" : "hover:text-slate-900"
                )}
              >
                Vùng miền
              </button>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-[280px] md:h-[350px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {chartViewType === 'bar' ? (
              <BarChart data={timelineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                  dy={8}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}Tr`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return val;
                  }}
                  dx={-5}
                />
                <Tooltip 
                  formatter={(val: any, name: any) => [formatCurrency(Number(val)), name === 'Thu' ? 'Thu nhập' : name === 'Chi' ? 'Chi phí' : name]}
                  labelFormatter={(_label, payload) => {
                    if (payload && payload[0]?.payload?.fullLabel) {
                      return payload[0].payload.fullLabel;
                    }
                    return _label;
                  }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
                <Bar dataKey="Thu" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Chi" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            ) : (
              <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorThu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorChi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
                  dy={8}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}Tr`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return val;
                  }}
                  dx={-5}
                />
                <Tooltip 
                  formatter={(val: any, name: any) => [formatCurrency(Number(val)), name === 'Thu' ? 'Thu nhập' : name === 'Chi' ? 'Chi phí' : name]}
                  labelFormatter={(_label, payload) => {
                    if (payload && payload[0]?.payload?.fullLabel) {
                      return payload[0].payload.fullLabel;
                    }
                    return _label;
                  }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
                <Area type="monotone" dataKey="Thu" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorThu)" />
                <Area type="monotone" dataKey="Chi" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorChi)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
          {highestDay && (
            <div className="p-3 bg-red-50/70 rounded-xl border border-red-100 flex items-center justify-between">
              <span className="text-red-800 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-red-500" />
                Ngày chi nhiều nhất trong kỳ:
              </span>
              <span className="font-extrabold text-red-700">
                {highestDay.fullLabel || highestDay.label} ({formatCurrency(highestDay.Chi)})
              </span>
            </div>
          )}
          {topCategory && (
            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between">
              <span className="text-indigo-900 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Hạng mục chiếm tỷ trọng lớn nhất:
              </span>
              <span className="font-extrabold text-indigo-700">
                {topCategory.category} ({topCategory.percentage}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Category Breakdown: Thống kê chi tiết theo Hạng Mục */}
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Category Header & Type Switcher (Chi vs Thu) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-600" />
              <span>Phân Tích Cơ Cấu Theo Hạng Mục</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Xem rõ từng hạng mục đã chi hết bao nhiêu tiền, tỷ trọng % và danh sách khoản chi chi tiết
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Switch between Expense Categories & Income Categories */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setCategoryType('expense')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                  categoryType === 'expense'
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Hạng mục Chi ({formatCurrency(totalExpense)})</span>
              </button>
              <button
                onClick={() => setCategoryType('income')}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                  categoryType === 'income'
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Hạng mục Thu ({formatCurrency(totalIncome)})</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2 Columns: Donut Chart on Left, Ranked Category List on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Donut Chart & Legend */}
          <div className="lg:col-span-5 bg-slate-50/70 p-4 md:p-6 rounded-2xl border border-slate-200/60 flex flex-col items-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 self-start mb-2">
              Biểu đồ tỷ trọng {categoryType === 'expense' ? 'Khoản Chi' : 'Khoản Thu'}
            </h4>

            {pieChartData.length > 0 ? (
              <div className="w-full flex flex-col items-center">
                <div className="h-[240px] md:h-[260px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [formatCurrency(Number(value)), 'Số tiền']}
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 10px 20px -5px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng {categoryType === 'expense' ? 'chi' : 'thu'}</span>
                    <span className="text-sm md:text-base font-black text-slate-800">
                      {formatCurrency(categoryStats.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="w-full space-y-1.5 mt-2 max-h-[180px] overflow-y-auto pr-1">
                  {pieChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-white transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                        <span className="text-[11px] font-bold text-slate-400 w-11 text-right">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs">
                Chưa có dữ liệu {categoryType === 'expense' ? 'chi phí' : 'thu nhập'} trong kỳ này
              </div>
            )}
          </div>

          {/* Right Column: Ranked Category List with Details & Drill-down */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Xếp hạng chi tiêu theo hạng mục ({categoryStats.items.length} hạng mục)
              </h4>
              
              {/* Search Category */}
              <div className="relative w-44 md:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm hạng mục..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* List of items */}
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {visibleCategories.map((item, idx) => {
                const isExpanded = expandedCategory === item.category;

                return (
                  <div 
                    key={item.category}
                    className="p-3.5 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-200/70 transition-all space-y-2.5"
                  >
                    {/* Top Row: Rank, Category name, Amount, Percentage */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs md:text-sm text-slate-900 truncate">
                            {item.category}
                          </h5>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {item.count} phiếu giao dịch
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={cn(
                          "font-black text-xs md:text-sm",
                          categoryType === 'expense' ? "text-red-600" : "text-emerald-600"
                        )}>
                          {categoryType === 'expense' ? '-' : '+'}{formatCurrency(item.total)}
                        </span>
                        <div className="text-[11px] font-extrabold text-slate-500">
                          {item.percentage}% tổng {categoryType === 'expense' ? 'chi' : 'thu'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                          backgroundColor: item.color 
                        }} 
                      />
                    </div>

                    {/* Action buttons & Drilldown Toggle */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : item.category)}
                        className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Thu gọn' : `Xem ${item.count} giao dịch cụ thể`}</span>
                      </button>

                      <button
                        onClick={() => onSwitchToActualList(item.category)}
                        className="font-bold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1"
                        title="Lọc trong sổ thu chi"
                      >
                        <span>Lọc trong sổ</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Drill-down transactions accordion */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-2 border-t border-slate-200/70 space-y-1.5 overflow-hidden"
                        >
                          {item.transactions.map((tx: any) => {
                            const d = parseTxDate(tx.date);
                            return (
                              <div 
                                key={tx.id} 
                                className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold text-slate-800 truncate">
                                    {tx.description || item.category}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                    <span>{d ? format(d, 'dd/MM/yyyy') : 'N/A'}</span>
                                    {tx.planTitle && (
                                      <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[9px] font-bold">
                                        KH: {tx.planTitle}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={cn(
                                  "font-bold text-xs shrink-0",
                                  tx.type === 'expense' ? "text-red-600" : "text-emerald-600"
                                )}>
                                  {formatCurrency(tx.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {visibleCategories.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  Không tìm thấy hạng mục nào phù hợp
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Plans Correlation (Chi tiêu theo kế hoạch sản xuất nông trại) */}
      {planExpenditure.length > 0 && (
        <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Chi Tiêu Gắn Liền Với Kế Hoạch Sản Xuất</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các khoản chi trong kỳ đã được phân bổ cho kế hoạch công việc nào của trại nấm
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planExpenditure.map(p => (
              <div 
                key={p.planId}
                className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/70 flex flex-col justify-between space-y-2"
              >
                <div>
                  <h4 className="font-bold text-xs md:text-sm text-slate-900 line-clamp-1">{p.title}</h4>
                  <span className="text-[11px] text-slate-400">{p.count} khoản chi trong kỳ</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Đã chi</span>
                  <span className="font-black text-sm text-red-600">{formatCurrency(p.spent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
