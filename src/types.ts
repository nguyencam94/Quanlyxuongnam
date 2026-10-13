export type Tab = 'dashboard' | 'campaigns' | 'plans' | 'transactions' | 'orders' | 'workers';

export interface Campaign {
  id: string;
  name: string;
  code?: string;
  variety?: string; // Giống nấm (Bào ngư xám, Linh chi, Mối đen, Nấm rơm...)
  location?: string; // Nhà nấm / Khu vực
  startDate: any;
  endDate?: any;
  status: 'active' | 'completed' | 'planned' | 'paused';
  totalBags?: number; // Tổng số bịch phôi nấm
  expectedYield?: number; // Sản lượng dự kiến (kg)
  actualYield?: number; // Sản lượng thực tế (kg)
  description?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: any;
}

export interface BudgetItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  isPaid?: boolean;
  actualAmount?: number;
  paidDate?: string;
  notes?: string;
}

export interface PlanSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PlanExtension {
  id: string;
  extensionNumber: number;
  extendedAt: string;
  previousDate: string;
  newDate: string;
  reason?: string;
}

export interface Plan {
  id: string;
  title: string;
  description?: string;
  startDate: any;
  endDate?: any;
  status: 'todo' | 'in-progress' | 'done';
  subtasks?: PlanSubtask[];
  budgetItems?: BudgetItem[];
  estimatedCost?: number;
  assignedTo?: string;
  createdBy?: string;
  extensionCount?: number;
  extensions?: PlanExtension[];
  originalStartDate?: any;
  originalEndDate?: any;
  campaignId?: string;
  campaignName?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  date: any;
  planId?: string;
  planTitle?: string;
  budgetItemId?: string;
  campaignId?: string;
  campaignName?: string;
  createdBy?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items?: string;
  orderTime?: any;
  createdAt?: any;
  createdBy?: string;
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  phone?: string;
  salary: number;
  status: 'active' | 'inactive';
}
