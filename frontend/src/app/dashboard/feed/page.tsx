'use client';

import { useState, useEffect, useCallback } from 'react';
import { feedApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Wheat, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invRes, consRes] = await Promise.all([
        feedApi.inventory(),
        feedApi.consumption({ limit: 10 }),
      ]);
      setInventory(invRes.data.data);
      setConsumption(consRes.data.data);
    } catch { toast.error('Failed to load feed data'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Feed Management</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Track inventory and consumption
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary h-10 px-3">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inventory */}
        <div className="card h-fit space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Wheat size={16} className="text-amber-400" /> Current Inventory
            </h3>
            <button className="btn-secondary text-xs h-8 px-3">+ Add Stock</button>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)
            ) : inventory.length === 0 ? (
              <p className="text-center py-4 text-sm text-gray-400">No inventory found</p>
            ) : (
              inventory.map((item) => {
                const pct = Math.min(100, (item.availableStock / item.quantityPurchased) * 100);
                const isLow = item.isLowStock;
                return (
                  <div key={item.id} className="p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className={`text-sm font-medium ${isLow ? 'text-red-400' : 'text-gray-200'}`}>
                          {item.feedType}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Supplier: {item.supplier || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-200">{item.availableStock.toFixed(1)} kg</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(item.costPerKg)}/kg</p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isLow ? '#ef4444' : pct > 50 ? '#10b981' : '#f59e0b',
                        }}
                      />
                    </div>
                    {isLow && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                        <AlertTriangle size={12} /> Low stock warning (Min: {item.minimumThreshold}kg)
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Consumption */}
        <div className="card h-fit space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Recent Consumption</h3>
            <button className="btn-primary text-xs h-8 px-3">Log Feeding</button>
          </div>
          
          <div className="space-y-2">
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)
            ) : consumption.length === 0 ? (
              <p className="text-center py-4 text-sm text-gray-400">No recent feeding logs</p>
            ) : (
              consumption.map((log) => (
                <div key={log.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-sm font-medium text-gray-200">{log.animal?.customId} - {log.feedInventory?.feedType}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(log.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-amber-400">{log.quantity} kg</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(log.totalCost)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
