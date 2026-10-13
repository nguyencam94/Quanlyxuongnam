import React, { useState, useMemo } from 'react';
import { 
  Sprout, 
  Calendar, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  CheckSquare, 
  Square, 
  MapPin, 
  Scale, 
  Package, 
  BarChart3, 
  Sparkles, 
  FileText,
  DollarSign,
  ChevronRight,
  ListTodo,
  Receipt,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Campaign, Plan, Transaction } from '../types';
import { 
  addCampaign, 
  updateCampaign, 
  deleteCampaign, 
  addPlan, 
  updatePlan, 
  addTransaction, 
  deleteTransaction 
} from '../services/firestore';
import { cn, formatCurrency } from '../lib/utils';

interface CampaignsProps {
  campaigns: Campaign[];
  plans: Plan[];
  transactions: Transaction[];
  onNavigateTab?: (tab: any) => void;
}

const COMMON_VARIETIES = [
  'Nấm Bào ngư xám',
  'Nấm Mối đen',
  'Nấm Linh chi đỏ',
  'Nấm Rơm',
  'Nấm Hoàng kim',
  'Nấm Hương (Đông cô)',
  'Nấm Đùi gà',
  'Nấm Mộc nhĩ (Nấm mèo)',
  'Nấm Mỡ'
];

const COMMON_LOCATIONS = [
  'Nhà nấm số 1',
  'Nhà nấm số 2',
  'Nhà nấm số 3',
  'Nhà nấm số 4',
  'Trại ươm tơ',
  'Khu trồng thử nghiệm'
];

export const Campaigns: React.FC<CampaignsProps> = ({ 
  campaigns = [], 
  plans = [], 
  transactions = [],
  onNavigateTab 
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planned' | 'completed' | 'paused'>('all');
  
  // Modals
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Plan Modal inside Campaign
  const [showQuickPlanModal, setShowQuickPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    startDate: format(new Date(), "yyyy-MM-dd'T'08:00"),
    endDate: format(new Date(Date.now() + 86400000 * 2), "yyyy-MM-dd'T'18:00"),
    status: 'todo' as const,
    subtasksText: ''
  });

  // Quick Transaction Modal inside Campaign
  const [showQuickTxModal, setShowQuickTxModal] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Campaign Detail Tab
  const [detailTab, setDetailTab] = useState<'plans' | 'transactions' | 'overview'>('plans');

  // Form State for Campaign Create/Edit
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    code: '',
    variety: 'Nấm Bào ngư xám',
    location: 'Nhà nấm số 1',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 86400000 * 45), 'yyyy-MM-dd'),
    status: 'active' as 'active' | 'planned' | 'completed' | 'paused',
    totalBags: '5000',
    expectedYield: '1200',
    actualYield: '',
    description: '',
    notes: ''
  });

  const selectedCampaign = useMemo(() => {
    if (!selectedCampaignId) return null;
    return campaigns.find(c => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Date helper
  const getDateObj = (val: any): Date | null => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchSearch = 
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.variety && c.variety.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.location && c.location.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Compute stats for all campaigns
  const aggregateStats = useMemo(() => {
    const activeCount = campaigns.filter(c => c.status === 'active').length;
    const totalBags = campaigns.reduce((sum, c) => sum + (Number(c.totalBags) || 0), 0);
    
    // Transactions tied to any campaign
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      if (t.campaignId) {
        if (t.type === 'income') totalIncome += Number(t.amount) || 0;
        if (t.type === 'expense') totalExpense += Number(t.amount) || 0;
      }
    });

    return {
      activeCount,
      totalCount: campaigns.length,
      totalBags,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense
    };
  }, [campaigns, transactions]);

  // Compute metrics for a single campaign
  const getCampaignMetrics = (campaignId: string) => {
    const cPlans = plans.filter(p => p.campaignId === campaignId);
    const cTransactions = transactions.filter(t => t.campaignId === campaignId);
    
    const income = cTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const expense = cTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const profit = income - expense;

    const completedPlans = cPlans.filter(p => p.status === 'done').length;
    const totalPlans = cPlans.length;
    const progress = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    return {
      plans: cPlans,
      transactions: cTransactions,
      income,
      expense,
      profit,
      completedPlans,
      totalPlans,
      progress
    };
  };

  const openCreateModal = () => {
    const now = new Date();
    const future = new Date(Date.now() + 86400000 * 45); // +45 days
    const nextCode = `CD-${format(now, 'yyMM')}-${(campaigns.length + 1).toString().padStart(2, '0')}`;
    setCampaignForm({
      name: `Đợt nấm Bào ngư tháng ${format(now, 'MM/yyyy')}`,
      code: nextCode,
      variety: 'Nấm Bào ngư xám',
      location: 'Nhà nấm số 1',
      startDate: format(now, 'yyyy-MM-dd'),
      endDate: format(future, 'yyyy-MM-dd'),
      status: 'active',
      totalBags: '5000',
      expectedYield: '1200',
      actualYield: '',
      description: 'Đợt phôi nấm nhập mới, quy trình ươm tơ và xả ẩm chuẩn kỹ thuật Michfarm.',
      notes: ''
    });
    setEditingCampaign(null);
    setShowCampaignModal(true);
  };

  const openEditModal = (c: Campaign) => {
    const sDate = getDateObj(c.startDate) || new Date();
    const eDate = getDateObj(c.endDate) || new Date(Date.now() + 86400000 * 45);
    setCampaignForm({
      name: c.name || '',
      code: c.code || '',
      variety: c.variety || 'Nấm Bào ngư xám',
      location: c.location || 'Nhà nấm số 1',
      startDate: format(sDate, 'yyyy-MM-dd'),
      endDate: format(eDate, 'yyyy-MM-dd'),
      status: c.status || 'active',
      totalBags: c.totalBags ? String(c.totalBags) : '',
      expectedYield: c.expectedYield ? String(c.expectedYield) : '',
      actualYield: c.actualYield ? String(c.actualYield) : '',
      description: c.description || '',
      notes: c.notes || ''
    });
    setEditingCampaign(c);
    setShowCampaignModal(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: any = {
        name: campaignForm.name.trim(),
        code: campaignForm.code.trim(),
        variety: campaignForm.variety.trim(),
        location: campaignForm.location.trim(),
        startDate: campaignForm.startDate,
        endDate: campaignForm.endDate ? campaignForm.endDate : null,
        status: campaignForm.status,
        totalBags: campaignForm.totalBags ? Number(campaignForm.totalBags) : 0,
        expectedYield: campaignForm.expectedYield ? Number(campaignForm.expectedYield) : 0,
        actualYield: campaignForm.actualYield ? Number(campaignForm.actualYield) : 0,
        description: campaignForm.description.trim(),
        notes: campaignForm.notes.trim()
      };

      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, payload);
      } else {
        await addCampaign(payload);
      }
      setShowCampaignModal(false);
      setEditingCampaign(null);
    } catch (error) {
      console.error('Error saving campaign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deletingCampaign) return;
    setIsSubmitting(true);
    try {
      await deleteCampaign(deletingCampaign.id);
      if (selectedCampaignId === deletingCampaign.id) {
        setSelectedCampaignId(null);
      }
      setDeletingCampaign(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Plan Creation for the current Campaign
  const handleCreateQuickPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !planForm.title.trim()) return;

    setIsSubmitting(true);
    try {
      const subtasks = planForm.subtasksText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(title => ({
          id: Math.random().toString(36).substring(2, 9),
          title,
          completed: false
        }));

      await addPlan({
        title: planForm.title.trim(),
        description: planForm.description.trim(),
        startDate: planForm.startDate,
        endDate: planForm.endDate,
        status: planForm.status,
        campaignId: selectedCampaign.id,
        campaignName: selectedCampaign.name,
        subtasks
      });

      setShowQuickPlanModal(false);
      setPlanForm({
        title: '',
        description: '',
        startDate: format(new Date(), "yyyy-MM-dd'T'08:00"),
        endDate: format(new Date(Date.now() + 86400000 * 2), "yyyy-MM-dd'T'18:00"),
        status: 'todo',
        subtasksText: ''
      });
    } catch (err) {
      console.error('Error creating plan for campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Transaction Creation for the current Campaign
  const handleCreateQuickTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !txForm.amount) return;

    setIsSubmitting(true);
    try {
      await addTransaction({
        type: txForm.type,
        amount: Number(txForm.amount),
        category: txForm.category.trim() || (txForm.type === 'income' ? 'Bán nấm' : 'Vật tư đợt nấm'),
        description: txForm.description.trim() || `Thu chi đợt nấm: ${selectedCampaign.name}`,
        date: txForm.date,
        campaignId: selectedCampaign.id,
        campaignName: selectedCampaign.name
      });

      setShowQuickTxModal(false);
      setTxForm({
        type: 'income',
        amount: '',
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (err) {
      console.error('Error creating transaction for campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Populate template tasks for mushroom cycle
  const handleAddTemplateTasks = async () => {
    if (!selectedCampaign) return;
    const confirmAdd = window.confirm('Bạn có muốn tạo bộ kế hoạch mẫu chuẩn cho đợt nấm này (Vệ sinh, Nhập phôi, Xả ẩm, Thu hoạch)?');
    if (!confirmAdd) return;

    setIsSubmitting(true);
    try {
      const sDate = getDateObj(selectedCampaign.startDate) || new Date();
      const templates = [
        {
          title: `[${selectedCampaign.code || 'Vụ nấm'}] Vệ sinh khử trùng nhà nấm`,
          description: 'Quét dọn, rắc vôi bột, xông formol hoặc khử khuẩn giàn kệ trước khi chuyển bịch phôi vào.',
          startDate: format(sDate, "yyyy-MM-dd'T'08:00"),
          endDate: format(new Date(sDate.getTime() + 86400000 * 2), "yyyy-MM-dd'T'17:00"),
          subtasks: [
            { id: '1', title: 'Quét dọn sạch sàn và giàn treo', completed: false },
            { id: '2', title: 'Rắc vôi bột khử khuẩn', completed: false },
            { id: '3', title: 'Kiểm tra hệ thống phun sương', completed: false }
          ]
        },
        {
          title: `[${selectedCampaign.code || 'Vụ nấm'}] Nhập và xếp bịch phôi nấm vào giàn`,
          description: `Chuyển ${selectedCampaign.totalBags || 5000} bịch phôi vào ${selectedCampaign.location || 'nhà nấm'}. Kiểm tra độ chặt và độ đồng đều của tơ nấm.`,
          startDate: format(new Date(sDate.getTime() + 86400000 * 3), "yyyy-MM-dd'T'07:30"),
          endDate: format(new Date(sDate.getTime() + 86400000 * 5), "yyyy-MM-dd'T'17:30"),
          subtasks: [
            { id: '1', title: 'Kiểm đếm số lượng bịch phôi thực tế nhận', completed: false },
            { id: '2', title: 'Xếp lên giàn treo đúng khoảng cách', completed: false },
            { id: '3', title: 'Ghi nhật ký số lượng bịch hỏng/vỡ', completed: false }
          ]
        },
        {
          title: `[${selectedCampaign.code || 'Vụ nấm'}] Chăm sóc ươm tơ & Rạch bịch đón nấm`,
          description: 'Theo dõi nhiệt độ 25-28°C, độ ẩm 75-80%. Khi tơ chạy kín đáy thì tiến hành rạch bịch xả ẩm đón nấm đợt 1.',
          startDate: format(new Date(sDate.getTime() + 86400000 * 15), "yyyy-MM-dd'T'08:00"),
          endDate: format(new Date(sDate.getTime() + 86400000 * 20), "yyyy-MM-dd'T'17:00"),
          subtasks: [
            { id: '1', title: 'Kiểm tra độ phủ tơ trắng toàn bịch', completed: false },
            { id: '2', title: 'Rạch vết so le trên thân bịch', completed: false },
            { id: '3', title: 'Tưới đón nấm kích ẩm 85-90%', completed: false }
          ]
        },
        {
          title: `[${selectedCampaign.code || 'Vụ nấm'}] Thu hoạch nấm đợt 1 & Đóng gói`,
          description: 'Hái nấm sáng sớm khi mép mũ nấm còn hơi cụp. Cắt chân nấm sạch sẽ, phân loại và đóng gói giao khách.',
          startDate: format(new Date(sDate.getTime() + 86400000 * 25), "yyyy-MM-dd'T'05:30"),
          endDate: format(new Date(sDate.getTime() + 86400000 * 28), "yyyy-MM-dd'T'11:00"),
          subtasks: [
            { id: '1', title: 'Hái sạch gốc tránh thối bịch', completed: false },
            { id: '2', title: 'Cân và ghi chép sản lượng đợt 1', completed: false },
            { id: '3', title: 'Đóng thùng xốp/hộp giao thương lái', completed: false }
          ]
        }
      ];

      for (const t of templates) {
        await addPlan({
          ...t,
          status: 'todo',
          campaignId: selectedCampaign.id,
          campaignName: selectedCampaign.name
        });
      }
    } catch (err) {
      console.error('Error adding template plans:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig = {
    active: { label: 'Đang vào nấm', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    planned: { label: 'Lên kế hoạch', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    completed: { label: 'Đã kết thúc', color: 'bg-slate-100 text-slate-800 border-slate-300' },
    paused: { label: 'Tạm ngưng', color: 'bg-amber-100 text-amber-800 border-amber-300' }
  };

  // ==========================================
  // RENDER: SINGLE CAMPAIGN DETAIL VIEW
  // ==========================================
  if (selectedCampaign) {
    const metrics = getCampaignMetrics(selectedCampaign.id);
    const sDate = getDateObj(selectedCampaign.startDate);
    const eDate = getDateObj(selectedCampaign.endDate);

    const costPerBag = selectedCampaign.totalBags && selectedCampaign.totalBags > 0
      ? Math.round(metrics.expense / selectedCampaign.totalBags)
      : 0;
    const profitPerBag = selectedCampaign.totalBags && selectedCampaign.totalBags > 0
      ? Math.round(metrics.profit / selectedCampaign.totalBags)
      : 0;
    const yieldPercentage = selectedCampaign.expectedYield && selectedCampaign.expectedYield > 0 && selectedCampaign.actualYield
      ? Math.round((Number(selectedCampaign.actualYield) / Number(selectedCampaign.expectedYield)) * 100)
      : null;

    return (
      <div className="space-y-4 md:space-y-6">
        {/* Top bar with back button & actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCampaignId(null)}
              className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 touch-manipulation"
              title="Quay lại danh sách chiến dịch"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                  statusConfig[selectedCampaign.status]?.color || 'bg-slate-100 text-slate-800'
                )}>
                  {statusConfig[selectedCampaign.status]?.label || selectedCampaign.status}
                </span>
                {selectedCampaign.code && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    #{selectedCampaign.code}
                  </span>
                )}
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                  <Sprout className="w-3.5 h-3.5" />
                  {selectedCampaign.variety || 'Nấm'}
                </span>
              </div>
              <h1 className="text-lg md:text-2xl font-black text-slate-900 mt-1">
                {selectedCampaign.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              onClick={() => openEditModal(selectedCampaign)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-all active:scale-95 touch-manipulation"
            >
              <Edit className="w-4 h-4" />
              <span>Chỉnh sửa</span>
            </button>
            <button
              onClick={() => setDeletingCampaign(selectedCampaign)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-bold transition-all active:scale-95 touch-manipulation"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa</span>
            </button>
          </div>
        </div>

        {/* Campaign KPI Summary Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Revenue */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
              <span>Doanh thu thu hoạch</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg md:text-2xl font-black text-emerald-600">
              {formatCurrency(metrics.income)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.transactions.filter(t => t.type === 'income').length} đợt bán nấm
            </div>
          </div>

          {/* Expense */}
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
              <span>Chi phí đợt nấm</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg md:text-2xl font-black text-rose-600">
              {formatCurrency(metrics.expense)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {costPerBag > 0 ? `~${formatCurrency(costPerBag)} / bịch` : 'Phôi giống, điện, vật tư'}
            </div>
          </div>

          {/* Profit */}
          <div className={cn(
            "p-4 rounded-2xl border shadow-xs relative overflow-hidden",
            metrics.profit >= 0 ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"
          )}>
            <div className="flex items-center justify-between text-slate-600 text-xs font-bold mb-1">
              <span>Lợi nhuận ròng</span>
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                metrics.profit >= 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              )}>
                ₫
              </div>
            </div>
            <div className={cn(
              "text-lg md:text-2xl font-black",
              metrics.profit >= 0 ? "text-emerald-700" : "text-rose-700"
            )}>
              {metrics.profit >= 0 ? '+' : ''}{formatCurrency(metrics.profit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {profitPerBag !== 0 ? `Lãi ${formatCurrency(profitPerBag)} / bịch` : 'Thu trừ Chi'}
            </div>
          </div>

          {/* Bags & Yield */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
              <span>Phôi & Sản lượng</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg md:text-2xl font-black text-slate-800">
              {(selectedCampaign.totalBags || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">bịch</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 truncate">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {selectedCampaign.actualYield ? `${selectedCampaign.actualYield}kg` : 'Chưa thu'} 
                {selectedCampaign.expectedYield ? ` / Dự kiến ${selectedCampaign.expectedYield}kg` : ''}
                {yieldPercentage !== null ? ` (${yieldPercentage}%)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Location & Time info ribbon */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm text-indigo-900 font-medium">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-bold">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>Khu vực: {selectedCampaign.location || 'Chưa ghi nhà nấm'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>
                Bắt đầu: <strong className="font-bold">{sDate ? format(sDate, 'dd/MM/yyyy') : 'N/A'}</strong>
              </span>
            </span>
            {eDate && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>
                  Dự kiến xong: <strong className="font-bold">{format(eDate, 'dd/MM/yyyy')}</strong>
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-700">Tiến độ mục tiêu:</span>
            <div className="w-24 h-2.5 bg-indigo-200/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${metrics.progress}%` }}
              ></div>
            </div>
            <span className="text-xs font-extrabold text-indigo-700">{metrics.progress}%</span>
          </div>
        </div>

        {/* Campaign Sub-Tabs */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
          <button
            onClick={() => setDetailTab('plans')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap min-h-[44px]",
              detailTab === 'plans'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <ListTodo className="w-4 h-4" />
            <span>Kế hoạch đợt nấm ({metrics.plans.length})</span>
          </button>

          <button
            onClick={() => setDetailTab('transactions')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap min-h-[44px]",
              detailTab === 'transactions'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Receipt className="w-4 h-4" />
            <span>Thu chi đợt nấm ({metrics.transactions.length})</span>
          </button>

          <button
            onClick={() => setDetailTab('overview')}
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap min-h-[44px]",
              detailTab === 'overview'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Kỹ thuật & Nhật ký</span>
          </button>
        </div>

        {/* TAB 1: PLANS FOR THIS CAMPAIGN */}
        {detailTab === 'plans' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Nhiệm vụ & Quy trình đợt nấm</h3>
                <p className="text-slate-500 text-xs">Các công việc khử trùng, nhập bịch phôi, rạch bịch, tưới ẩm, thu hoạch của đợt này</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {metrics.plans.length === 0 && (
                  <button
                    onClick={handleAddTemplateTasks}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nạp quy trình mẫu</span>
                  </button>
                )}
                <button
                  onClick={() => setShowQuickPlanModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-100 active:scale-95 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm kế hoạch</span>
                </button>
              </div>
            </div>

            {metrics.plans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <ListTodo className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-base">Chưa có kế hoạch nào cho đợt nấm này</h4>
                <p className="text-slate-500 text-xs max-w-md mx-auto">
                  Hãy lên lịch các công việc như: Vệ sinh nhà nấm, Nhập phôi, Rạch bịch, Thu hoạch hoặc bấm nút bên dưới để tạo nhanh quy trình chuẩn.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={handleAddTemplateTasks}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Tạo 4 bước quy trình chuẩn
                  </button>
                  <button
                    onClick={() => setShowQuickPlanModal(true)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Tự viết kế hoạch
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {metrics.plans.map(p => {
                  const pStart = getDateObj(p.startDate);
                  const pEnd = getDateObj(p.endDate);
                  const totalSub = p.subtasks?.length || 0;
                  const doneSub = p.subtasks?.filter(s => s.completed).length || 0;

                  return (
                    <div 
                      key={p.id}
                      className={cn(
                        "bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3 relative group",
                        p.status === 'done' ? "border-emerald-200 bg-emerald-50/20" : "border-slate-100 hover:border-indigo-200 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <button
                            onClick={async () => {
                              const newStatus = p.status === 'done' ? 'todo' : 'done';
                              await updatePlan(p.id, { status: newStatus });
                            }}
                            className={cn(
                              "mt-0.5 min-w-[28px] min-h-[28px] rounded-lg flex items-center justify-center transition-all",
                              p.status === 'done' ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                            )}
                          >
                            {p.status === 'done' ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "font-bold text-sm text-slate-900 leading-snug",
                              p.status === 'done' && "line-through text-slate-500"
                            )}>
                              {p.title}
                            </h4>
                            {p.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0",
                          p.status === 'done' ? "bg-emerald-100 text-emerald-800" :
                          p.status === 'in-progress' ? "bg-blue-100 text-blue-800" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {p.status === 'done' ? 'Hoàn thành' : p.status === 'in-progress' ? 'Đang làm' : 'Cần làm'}
                        </span>
                      </div>

                      {/* Dates: Green dot for start date, Red dot for deadline */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          {pStart && (
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs ring-1 ring-emerald-300"></span>
                              <span>Bắt đầu: {format(pStart, 'dd/MM HH:mm')}</span>
                            </span>
                          )}
                          {pEnd && (
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-xs ring-1 ring-rose-300"></span>
                              <span>Hạn chót: {format(pEnd, 'dd/MM HH:mm')}</span>
                            </span>
                          )}
                        </div>

                        {totalSub > 0 && (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {doneSub}/{totalSub} việc con
                          </span>
                        )}
                      </div>

                      {/* Subtasks checklist preview */}
                      {p.subtasks && p.subtasks.length > 0 && (
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl text-xs">
                          {p.subtasks.map((st, sIdx) => (
                            <div 
                              key={st.id || sIdx}
                              onClick={async () => {
                                const nextSubtasks = [...p.subtasks!];
                                nextSubtasks[sIdx] = { ...st, completed: !st.completed };
                                await updatePlan(p.id, { subtasks: nextSubtasks });
                              }}
                              className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none py-0.5"
                            >
                              <div className={cn(
                                "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all",
                                st.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                              )}>
                                {st.completed && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span className={cn(
                                "truncate",
                                st.completed ? "line-through text-slate-400" : "text-slate-700 font-medium"
                              )}>
                                {st.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRANSACTIONS FOR THIS CAMPAIGN */}
        {detailTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Sổ thu chi đợt nấm</h3>
                <p className="text-slate-500 text-xs">Doanh thu bán nấm thu hoạch và các chi phí giống, điện nước, nhân công của chiến dịch</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTxForm(prev => ({ ...prev, type: 'income', category: 'Bán nấm thu hoạch' }));
                    setShowQuickTxModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ghi nhận Thu</span>
                </button>
                <button
                  onClick={() => {
                    setTxForm(prev => ({ ...prev, type: 'expense', category: 'Mua phôi giống' }));
                    setShowQuickTxModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Ghi nhận Chi</span>
                </button>
              </div>
            </div>

            {metrics.transactions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-base">Chưa có giao dịch thu chi cho đợt nấm này</h4>
                <p className="text-slate-500 text-xs max-w-md mx-auto">
                  Ghi lại chi phí mua phôi giống, chi phí điện nước, bao bì và doanh thu bán nấm từng đợt để hạch toán lãi lỗ chính xác.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: 'expense', category: 'Mua phôi giống' }));
                      setShowQuickTxModal(true);
                    }}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all"
                  >
                    Ghi chi phí giống
                  </button>
                  <button
                    onClick={() => {
                      setTxForm(prev => ({ ...prev, type: 'income', category: 'Bán nấm thu hoạch' }));
                      setShowQuickTxModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all"
                  >
                    Ghi doanh thu bán nấm
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {metrics.transactions.map(t => {
                    const tDate = getDateObj(t.date);
                    const isIncome = t.type === 'income';

                    return (
                      <div 
                        key={t.id}
                        className="p-3.5 sm:p-4 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm",
                            isIncome ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                          )}>
                            {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 text-sm truncate">
                                {t.category || (isIncome ? 'Khoản thu' : 'Khoản chi')}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {tDate ? format(tDate, 'dd/MM/yyyy') : ''}
                              </span>
                            </div>
                            {t.description && (
                              <p className="text-xs text-slate-500 truncate mt-0.5">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className={cn(
                            "text-sm sm:text-base font-black text-right",
                            isIncome ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                          </div>
                          <button
                            onClick={async () => {
                              if (window.confirm('Xóa giao dịch này?')) {
                                await deleteTransaction(t.id);
                              }
                            }}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Xóa giao dịch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OVERVIEW & TECHNICAL NOTES */}
        {detailTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Thông số kỹ thuật đợt nấm
              </h3>
              
              <div className="space-y-3 text-xs md:text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Giống nấm canh tác:</span>
                  <span className="font-bold text-slate-800">{selectedCampaign.variety || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Khu vực / Nhà nấm:</span>
                  <span className="font-bold text-slate-800">{selectedCampaign.location || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tổng số lượng bịch phôi:</span>
                  <span className="font-bold text-slate-800">{(selectedCampaign.totalBags || 0).toLocaleString()} bịch</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Sản lượng dự kiến:</span>
                  <span className="font-bold text-slate-800">{selectedCampaign.expectedYield ? `${selectedCampaign.expectedYield} kg` : 'Chưa nhập'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Sản lượng thực tế thu hoạch:</span>
                  <span className="font-bold text-emerald-700">{selectedCampaign.actualYield ? `${selectedCampaign.actualYield} kg` : 'Đang thu hoạch'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Chi phí trung bình / bịch phôi:</span>
                  <span className="font-bold text-rose-700">{costPerBag > 0 ? `${formatCurrency(costPerBag)} / bịch` : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Lãi ròng trung bình / bịch:</span>
                  <span className="font-bold text-emerald-700">{profitPerBag !== 0 ? `${formatCurrency(profitPerBag)} / bịch` : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Mô tả quy trình & Nhật ký vụ
              </h3>

              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-1">Mô tả đợt vào nấm:</h4>
                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                    {selectedCampaign.description || 'Chưa có ghi chú mô tả cho đợt nấm này.'}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-1">Ghi chú kỹ thuật & Lưu ý độ ẩm nhiệt độ:</h4>
                  <div className="bg-amber-50/60 border border-amber-200/60 p-3 rounded-xl text-xs text-amber-900 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                    {selectedCampaign.notes || 'Nhiệt độ thích hợp: 25-28°C. Độ ẩm không khí nuôi sợi 70-75%, xả ẩm thu hái 85-90%. Tưới dạng sương mịn vào không gian.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: QUICK PLAN */}
        {showQuickPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-indigo-600" />
                  Thêm kế hoạch cho đợt nấm
                </h3>
                <button 
                  onClick={() => setShowQuickPlanModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickPlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề kế hoạch *</label>
                  <input
                    type="text"
                    required
                    value={planForm.title}
                    onChange={e => setPlanForm({ ...planForm, title: e.target.value })}
                    placeholder="VD: Rạch bịch và tưới ẩm đợt 1..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Ngày bắt đầu *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={planForm.startDate}
                      onChange={e => setPlanForm({ ...planForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Thời hạn hoàn thành *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={planForm.endDate}
                      onChange={e => setPlanForm({ ...planForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Các việc con (Mỗi dòng 1 việc)</label>
                  <textarea
                    rows={3}
                    value={planForm.subtasksText}
                    onChange={e => setPlanForm({ ...planForm, subtasksText: e.target.value })}
                    placeholder="Kiểm tra độ ẩm&#10;Phun sương đều&#10;Ghi nhật ký"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả / Ghi chú</label>
                  <textarea
                    rows={2}
                    value={planForm.description}
                    onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Chi tiết yêu cầu..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuickPlanModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100"
                  >
                    Lưu kế hoạch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: QUICK TRANSACTION */}
        {showQuickTxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  {txForm.type === 'income' ? 'Ghi nhận Thu đợt nấm' : 'Ghi nhận Chi đợt nấm'}
                </h3>
                <button 
                  onClick={() => setShowQuickTxModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickTx} className="space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTxForm({ ...txForm, type: 'income', category: 'Bán nấm thu hoạch' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      txForm.type === 'income' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    + Thu (Doanh thu bán nấm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxForm({ ...txForm, type: 'expense', category: 'Mua phôi giống' })}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      txForm.type === 'expense' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    - Chi (Chi phí đợt nấm)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số tiền (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={txForm.amount}
                    onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                    placeholder="VD: 5000000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạng mục</label>
                  <input
                    type="text"
                    value={txForm.category}
                    onChange={e => setTxForm({ ...txForm, category: e.target.value })}
                    placeholder={txForm.type === 'income' ? 'Bán nấm tươi, Bán sỉ...' : 'Mua phôi giống, Điện nước...'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(txForm.type === 'income' 
                      ? ['Bán nấm sỉ', 'Bán nấm lẻ', 'Bán phôi thanh lý', 'Thu khác'] 
                      : ['Mua phôi giống', 'Tiền điện nước tưới', 'Vật tư xịt khử khuẩn', 'Bao bì đóng gói', 'Nhân công hái']
                    ).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTxForm({ ...txForm, category: tag })}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày giao dịch *</label>
                  <input
                    type="date"
                    required
                    value={txForm.date}
                    onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú chi tiết</label>
                  <input
                    type="text"
                    value={txForm.description}
                    onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                    placeholder="VD: Giao 100kg cho vựa nấm Chợ Đầu Mối..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuickTxModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md",
                      txForm.type === 'income' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
                    )}
                  >
                    Ghi nhận
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN CAMPAIGNS LIST
  // ==========================================
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sprout className="w-6 h-6 text-emerald-600" />
            Chiến dịch & Đợt vào nấm
          </h2>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">
            Quản lý từng đợt phôi nấm, kết nối kế hoạch chăm sóc và doanh thu chi phí từng vụ
          </p>
        </div>

        <button 
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-emerald-100 shrink-0 min-h-[44px] active:scale-95 touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          <span>Mở đợt vào nấm mới</span>
        </button>
      </div>

      {/* Aggregate KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Active Campaigns */}
        <div className="bg-white p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Đợt nấm đang chạy</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-900">
            {aggregateStats.activeCount} <span className="text-xs font-bold text-slate-400">/ {aggregateStats.totalCount} vụ</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            {(aggregateStats.totalBags || 0).toLocaleString()} bịch phôi trong trại
          </div>
        </div>

        {/* Total Campaign Revenue */}
        <div className="bg-white p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Doanh thu các vụ</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600 truncate">
            {formatCurrency(aggregateStats.totalIncome)}
          </div>
          <div className="text-[11px] text-slate-400">
            Tiền bán nấm hái từ các đợt
          </div>
        </div>

        {/* Total Campaign Expense */}
        <div className="bg-white p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Chi phí các vụ</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black text-rose-600 truncate">
            {formatCurrency(aggregateStats.totalExpense)}
          </div>
          <div className="text-[11px] text-slate-400">
            Chi phí giống, điện, vật tư
          </div>
        </div>

        {/* Total Campaign Profit */}
        <div className={cn(
          "p-4 rounded-2xl md:rounded-3xl border shadow-sm space-y-1",
          aggregateStats.netProfit >= 0 ? "bg-emerald-50/70 border-emerald-200" : "bg-rose-50/70 border-rose-200"
        )}>
          <div className="flex items-center justify-between text-slate-600 text-xs font-bold">
            <span>Lợi nhuận ròng vụ nấm</span>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white",
              aggregateStats.netProfit >= 0 ? "bg-emerald-600" : "bg-rose-600"
            )}>
              ₫
            </div>
          </div>
          <div className={cn(
            "text-xl md:text-2xl font-black truncate",
            aggregateStats.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
          )}>
            {aggregateStats.netProfit >= 0 ? '+' : ''}{formatCurrency(aggregateStats.netProfit)}
          </div>
          <div className="text-[11px] text-slate-500">
            Tổng thu trừ tổng chi
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'active', label: 'Đang vào nấm' },
            { id: 'planned', label: 'Lên kế hoạch' },
            { id: 'completed', label: 'Đã hoàn thành' },
            { id: 'paused', label: 'Tạm ngưng' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 touch-manipulation",
                statusFilter === f.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên, giống, nhà nấm..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
            <Sprout className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg">Chưa có chiến dịch đợt nấm nào</h3>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
            Bắt đầu bằng việc tạo một đợt vào nấm mới. Bạn có thể theo dõi số lượng bịch phôi, sản lượng thu hoạch, kế hoạch chăm sóc và doanh thu chi phí của từng đợt!
          </p>
          <div className="pt-2">
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-100 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Mở đợt vào nấm mới
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filteredCampaigns.map(c => {
            const metrics = getCampaignMetrics(c.id);
            const sDate = getDateObj(c.startDate);
            const eDate = getDateObj(c.endDate);

            return (
              <div 
                key={c.id}
                onClick={() => setSelectedCampaignId(c.id)}
                className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-4 md:p-5 flex flex-col justify-between group space-y-4 relative"
              >
                {/* Header row: Status badge + variety badge + action menu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                      statusConfig[c.status]?.color || 'bg-slate-100 text-slate-800'
                    )}>
                      {statusConfig[c.status]?.label || c.status}
                    </span>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                        title="Sửa chiến dịch"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingCampaign(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        title="Xóa chiến dịch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {c.code && (
                        <span className="text-[11px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          #{c.code}
                        </span>
                      )}
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Sprout className="w-3.5 h-3.5" />
                        {c.variety || 'Nấm'}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-900 text-base md:text-lg group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {c.name}
                    </h3>
                  </div>

                  {/* Location & Time */}
                  <div className="space-y-1 text-xs text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.location || 'Chưa định vị nhà nấm'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {sDate ? format(sDate, 'dd/MM/yyyy') : 'N/A'} 
                        {eDate ? ` ➔ ${format(eDate, 'dd/MM/yyyy')}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body Metrics: Bags & Harvest */}
                <div className="bg-slate-50/80 rounded-2xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Số bịch phôi:</span>
                    <span className="font-extrabold text-slate-800">
                      {(c.totalBags || 0).toLocaleString()} bịch
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Sản lượng nấm:</span>
                    <span className="font-bold text-slate-700">
                      {c.actualYield ? `${c.actualYield}kg` : '0kg'} / {c.expectedYield ? `${c.expectedYield}kg` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Lãi/Lỗ đợt nấm:</span>
                    <span className={cn(
                      "font-black text-sm",
                      metrics.profit >= 0 ? "text-emerald-700" : "text-rose-600"
                    )}>
                      {metrics.profit >= 0 ? '+' : ''}{formatCurrency(metrics.profit)}
                    </span>
                  </div>
                </div>

                {/* Footer: Progress & CTA */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                    <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{metrics.completedPlans}/{metrics.totalPlans} việc</span>
                  </div>
                  <span className="font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Xem chi tiết đợt nấm <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREATE / EDIT CAMPAIGN */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" />
                {editingCampaign ? 'Chỉnh sửa đợt vào nấm' : 'Mở đợt vào nấm mới'}
              </h3>
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên đợt nấm / Chiến dịch *</label>
                <input
                  type="text"
                  required
                  value={campaignForm.name}
                  onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="VD: Đợt nấm Bào ngư tháng 10/2026..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã đợt nấm</label>
                  <input
                    type="text"
                    value={campaignForm.code}
                    onChange={e => setCampaignForm({ ...campaignForm, code: e.target.value })}
                    placeholder="VD: CD-2610-01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái đợt</label>
                  <select
                    value={campaignForm.status}
                    onChange={e => setCampaignForm({ ...campaignForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="active">Đang vào nấm / Nuôi sợi</option>
                    <option value="planned">Lên kế hoạch đợt tới</option>
                    <option value="completed">Đã kết thúc vụ nấm</option>
                    <option value="paused">Tạm dừng đợt này</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giống nấm</label>
                  <input
                    type="text"
                    list="variety-list"
                    value={campaignForm.variety}
                    onChange={e => setCampaignForm({ ...campaignForm, variety: e.target.value })}
                    placeholder="VD: Nấm Bào ngư xám"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="variety-list">
                    {COMMON_VARIETIES.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nhà nấm / Khu vực</label>
                  <input
                    type="text"
                    list="location-list"
                    value={campaignForm.location}
                    onChange={e => setCampaignForm({ ...campaignForm, location: e.target.value })}
                    placeholder="VD: Nhà nấm số 1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="location-list">
                    {COMMON_LOCATIONS.map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Ngày bắt đầu vụ *
                  </label>
                  <input
                    type="date"
                    required
                    value={campaignForm.startDate}
                    onChange={e => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Ngày kết thúc dự kiến
                  </label>
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={e => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số bịch phôi nấm</label>
                  <input
                    type="number"
                    min="0"
                    value={campaignForm.totalBags}
                    onChange={e => setCampaignForm({ ...campaignForm, totalBags: e.target.value })}
                    placeholder="5000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sản lượng dự kiến (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={campaignForm.expectedYield}
                    onChange={e => setCampaignForm({ ...campaignForm, expectedYield: e.target.value })}
                    placeholder="1200"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sản lượng thực tế (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={campaignForm.actualYield}
                    onChange={e => setCampaignForm({ ...campaignForm, actualYield: e.target.value })}
                    placeholder="Đã hái..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả tổng quan đợt nấm</label>
                <textarea
                  rows={2}
                  value={campaignForm.description}
                  onChange={e => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder="Nguồn phôi, điều kiện trang trại..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú kỹ thuật & Chăm sóc</label>
                <textarea
                  rows={2}
                  value={campaignForm.notes}
                  onChange={e => setCampaignForm({ ...campaignForm, notes: e.target.value })}
                  placeholder="Nhiệt độ, ẩm độ, số lần phun sương hàng ngày..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-100"
                >
                  {editingCampaign ? 'Cập nhật' : 'Tạo đợt vào nấm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Xóa đợt vào nấm này?</h3>
              <p className="text-slate-500 text-xs mt-1">
                Bạn có chắc chắn muốn xóa chiến dịch <strong>{deletingCampaign.name}</strong>? Các kế hoạch và thu chi đã liên kết vẫn được giữ nguyên.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCampaign(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteCampaign}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-100"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
