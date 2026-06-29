import React, { useState, useEffect } from 'react';
import { BatteryLow, BatteryMedium, BatteryFull, Zap } from 'lucide-react';

const QuotaBattery = () => {
  const [quota, setQuota] = useState({ used_seconds: 0, limit_seconds: 3600 });
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const response = await fetch('http://localhost:8008/api/quota');
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (err) {
      console.error("Failed to fetch quota:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
    // Poll every 10 seconds to keep it updated
    const interval = setInterval(fetchQuota, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  const usedMinutes = Math.round(quota.used_seconds / 60);
  const limitMinutes = Math.round(quota.limit_seconds / 60);
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);
  const percentage = Math.max(0, Math.min(100, 100 - (quota.used_seconds / quota.limit_seconds) * 100));

  let BatteryIcon = BatteryFull;
  let colorClass = "text-green-500";
  let bgClass = "bg-green-100";

  if (percentage <= 20) {
    BatteryIcon = BatteryLow;
    colorClass = "text-red-500";
    bgClass = "bg-red-100";
  } else if (percentage <= 60) {
    BatteryIcon = BatteryMedium;
    colorClass = "text-yellow-500";
    bgClass = "bg-yellow-100";
  }

  return (
    <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 group">
      <div className={`relative flex items-center justify-center p-3 rounded-full shadow-lg border-2 ${bgClass} border-white cursor-help transition-transform hover:scale-110`}>
        <BatteryIcon className={`w-8 h-8 ${colorClass}`} />
        
        {/* Hover Tooltip */}
        <div className="absolute right-full mr-4 top-1/2 transform -translate-y-1/2 w-48 bg-gray-900 text-white text-sm rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">API Quota</span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-400">Remaining:</span>
            <span className={`font-bold ${colorClass}`}>{remainingMinutes}m</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Total Limit:</span>
            <span>{limitMinutes}m</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${percentage > 20 ? (percentage > 60 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-red-500'}`} 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaBattery;
