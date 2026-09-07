import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 text-white px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-xs animate-in slide-in-from-bottom-2 duration-300">
      <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      <span>Đang chạy ở chế độ Ngoại tuyến (Offline)</span>
    </div>
  );
};
