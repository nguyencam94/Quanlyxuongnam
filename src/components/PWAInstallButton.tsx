import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' | 'compact' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback for browsers that don't trigger beforeinstallprompt (e.g. Chrome desktop already prompted or desktop safari)
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          onClick={handleInstallClick}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center border border-indigo-100"
          title="Cài đặt ứng dụng về máy"
        >
          <Download className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className="flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-sm shadow-indigo-200 transition-all transform active:scale-95"
        >
          <Download className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
          <span className="whitespace-nowrap">Cài đặt App</span>
        </button>
      )}

      {/* Guide Modal for iOS Safari / Manual Installation */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-2xl border border-slate-100 text-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cài đặt BizFlow Michfarm
                  </h3>
                  <p className="text-xs text-slate-500">Trải nghiệm mượt mà như ứng dụng gốc</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs md:text-sm text-slate-600">
              <p className="font-semibold text-slate-700">
                {isIOS 
                  ? 'Hướng dẫn cài đặt trên iPhone / iPad (Safari):' 
                  : 'Hướng dẫn cài đặt trên thiết bị:'}
              </p>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <span>Nhấn vào biểu tượng </span>
                    <strong className="text-indigo-900 inline-flex items-center gap-1 font-bold">
                      <Share2 className="w-3.5 h-3.5 inline text-indigo-600" /> Chia sẻ (Share)
                    </strong>
                    <span> trên thanh công cụ trình duyệt Safari.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <span>Cuộn xuống danh sách tùy chọn và chọn </span>
                    <strong className="text-indigo-900 inline-flex items-center gap-1 font-bold">
                      <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600" /> Thêm vào MH chính (Add to Home Screen)
                    </strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <span>Nhấn </span>
                    <strong className="text-indigo-900 font-bold">Thêm (Add)</strong>
                    <span> ở góc trên bên phải. Biểu tượng Michfarm sẽ xuất hiện ngay trên màn hình chính!</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ưu điểm khi cài đặt PWA:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Mở toàn màn hình không có thanh địa chỉ web rườm rà</li>
                  <li>Tải ứng dụng nhanh gấp nhiều lần nhờ bộ nhớ đệm Offline Cache</li>
                  <li>Truy cập trực tiếp chỉ bằng 1 chạm từ màn hình chính</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs md:text-sm transition-all"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
