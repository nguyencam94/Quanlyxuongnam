import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CalendarClock, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { format, addDays, isPast } from 'date-fns';
import { vi } from 'date-fns/locale';
import { extendPlan } from '../services/firestore';
import { cn } from '../lib/utils';

interface ExtendPlanModalProps {
  plan: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Chờ nhập phôi nấm / meo giống',
  'Thời tiết mưa ẩm / chênh lệch nhiệt độ',
  'Thiếu nhân công thực hiện',
  'Cần kéo dài thời gian ủ tơ / nuôi sợi',
  'Khách hàng thay đổi lịch nhận nấm',
  'Bảo trì / khử trùng nhà nấm'
];

export const ExtendPlanModal: React.FC<ExtendPlanModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [newDateStr, setNewDateStr] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDeadline = (p: any): Date => {
    if (p?.endDate) {
      return p.endDate?.toDate ? p.endDate.toDate() : new Date(p.endDate);
    }
    if (p?.startDate) {
      return p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
    }
    return new Date();
  };

  const getStartDate = (p: any): Date | null => {
    if (!p?.startDate) return null;
    return p.startDate?.toDate ? p.startDate.toDate() : new Date(p.startDate);
  };

  useEffect(() => {
    if (plan) {
      const deadline = getDeadline(plan);
      // Default to tomorrow or +1 day from current deadline
      const baseDate = isPast(deadline) ? new Date() : deadline;
      const defaultNewDate = addDays(baseDate, 1);
      defaultNewDate.setHours(17, 0, 0, 0); // Default to 17:00
      setNewDateStr(format(defaultNewDate, "yyyy-MM-dd'T'HH:mm"));
      setReason('');
      setError(null);
    }
  }, [plan]);

  if (!isOpen || !plan) return null;

  const planDeadline = getDeadline(plan);
  const planStartDate = getStartDate(plan);
  const isOverdue = isPast(planDeadline) && plan.status !== 'done';
  const currentCount = plan.extensionCount || (plan.extensions?.length || 0);
  const nextExtensionNumber = currentCount + 1;

  const handleQuickAddDays = (days: number) => {
    const baseDate = isPast(planDeadline) ? new Date() : planDeadline;
    const targetDate = addDays(baseDate, days);
    targetDate.setHours(17, 0, 0, 0);
    setNewDateStr(format(targetDate, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDateStr) {
      setError('Vui lòng chọn thời hạn mới.');
      return;
    }

    const selectedNewDate = new Date(newDateStr);
    if (isNaN(selectedNewDate.getTime())) {
      setError('Ngày giờ gia hạn không hợp lệ.');
      return;
    }

    if (planStartDate && selectedNewDate < planStartDate) {
      setError('Thời hạn hoàn thành mới phải sau ngày bắt đầu mục tiêu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const success = await extendPlan(plan.id, plan, newDateStr, reason);
    setIsSubmitting(false);

    if (success) {
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setError('Đã có lỗi xảy ra khi lưu gia hạn. Vui lòng thử lại.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl p-5 md:p-7 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-sm",
                isOverdue ? "bg-amber-600" : "bg-indigo-600"
              )}>
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 leading-tight">
                  Gia hạn thời hạn công việc
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lần gia hạn tiếp theo: <span className="font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Lần {nextExtensionNumber}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Task Brief */}
          <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mục tiêu</span>
                <h4 className="text-sm font-black text-slate-800 leading-snug line-clamp-2">
                  {plan.title}
                </h4>
              </div>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0 border border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  Đã quá hạn
                </span>
              )}
            </div>

            {planStartDate && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 text-slate-600">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span> Ngày bắt đầu:
                </span>
                <span className="font-bold text-slate-700">
                  {format(planStartDate, 'HH:mm - dd/MM/yyyy')}
                </span>
              </div>
            )}

            <div className={cn(
              "flex items-center justify-between text-xs text-slate-600",
              !planStartDate && "pt-1 border-t border-slate-200/60"
            )}>
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span> Hạn chót hiện tại:
              </span>
              <span className="font-bold text-rose-700">
                {format(planDeadline, 'HH:mm - dd/MM/yyyy')}
              </span>
            </div>

            {currentCount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-xl border border-amber-100">
                <span className="flex items-center gap-1 font-semibold">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Đã gia hạn trước đó:
                </span>
                <span className="font-black">
                  {currentCount} lần
                </span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Extension Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Chọn nhanh thời gian gia hạn
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '+1 ngày', days: 1 },
                  { label: '+2 ngày', days: 2 },
                  { label: '+3 ngày', days: 3 },
                  { label: '+1 tuần', days: 7 }
                ].map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => handleQuickAddDays(item.days)}
                    className="py-2.5 px-1 text-center bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all border border-indigo-100 min-h-[40px] active:scale-95 touch-manipulation"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* New Deadline Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Thời hạn hoàn thành mới <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={newDateStr}
                onChange={(e) => setNewDateStr(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white min-h-[44px]"
              />
              {newDateStr && (
                <p className="text-[11px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Hạn mới sẽ là: {format(new Date(newDateStr), 'EEEE, dd/MM/yyyy - HH:mm', { locale: vi })}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Lý do gia hạn (Tùy chọn)
                </label>
                <span className="text-[10px] text-slate-400">Ghi lại để theo dõi</span>
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Chờ phôi giống, thiếu công nhân..."
                className="w-full px-3.5 py-2.5 sm:px-4 rounded-xl border border-slate-200 text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[44px]"
              />

              {/* Suggestions chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_REASONS.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReason(r)}
                    className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors text-left min-h-[32px] active:scale-95 touch-manipulation"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Notice Preview */}
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Sau khi xác nhận, hệ thống sẽ lưu nhật ký và gắn thông báo <strong>"Đã gia hạn lần {nextExtensionNumber}"</strong> trực tiếp lên chi tiết và danh sách mục tiêu.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs md:text-sm transition-all min-h-[48px] active:scale-95 touch-manipulation"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "flex-[2] py-3 text-white rounded-xl font-bold text-xs md:text-sm transition-all shadow-md flex items-center justify-center gap-2 min-h-[48px] active:scale-95 touch-manipulation",
                  isOverdue 
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" 
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                )}
              >
                {isSubmitting ? (
                  <span>Đang lưu gia hạn...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Xác nhận gia hạn (Lần {nextExtensionNumber})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
