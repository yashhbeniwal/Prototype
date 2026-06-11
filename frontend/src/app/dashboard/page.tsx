'use client';

import { useEffect, useState } from 'react';
import { animalApi, vaccinationApi, billingApi, feedApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Dog, Syringe, DollarSign, TrendingUp, AlertTriangle, TrendingDown,
  Activity, Wheat, Clock, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  color?: string;
  glow?: string;
}

function StatCard({ icon, label, value, sub, trend, color = '#6c47ff', glow }: StatCardProps) {
  return (
    <div
      className="stat-card relative overflow-hidden"
      style={{ borderColor: `${color}30` }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${color} 0%, transparent 60%)` }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}% from last month
            </div>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

const BREED_COLORS = ['#6c47ff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [dueVaccinations, setDueVaccinations] = useState<any>(null);
  const [billingDash, setBillingDash] = useState<any>(null);
  const [feedInventory, setFeedInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [animalRes, vacRes, billRes, feedRes] = await Promise.all([
          animalApi.stats(),
          vaccinationApi.due({ days: 30 }),
          billingApi.dashboard(),
          feedApi.inventory(),
        ]);
        setStats(animalRes.data.data);
        setDueVaccinations(vacRes.data.data);
        setBillingDash(billRes.data.data);
        setFeedInventory(feedRes.data.data || []);
      } catch (e) {
        console.error('Dashboard load failed', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-32 shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="card h-64 shimmer" />)}
        </div>
      </div>
    );
  }

  const breedData = (stats?.byBreed || []).slice(0, 6).map((b: any) => ({
    name: b.breed,
    value: b._count,
  }));

  const statusData = (stats?.byStatus || []).map((s: any) => ({
    name: s.status,
    count: s._count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Farm Overview</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {formatDate(new Date())} — Real-time farm intelligence
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Dog size={20} style={{ color: '#6c47ff' }} />}
          label="Active Animals"
          value={stats?.totalActive || 0}
          sub={`${stats?.recentlyAdded || 0} added this month`}
          color="#6c47ff"
        />
        <StatCard
          icon={<Syringe size={20} style={{ color: '#f59e0b' }} />}
          label="Vaccinations Due"
          value={(dueVaccinations?.overdue?.length || 0) + (dueVaccinations?.thisWeek?.length || 0)}
          sub={`${dueVaccinations?.overdue?.length || 0} overdue`}
          color="#f59e0b"
        />
        <StatCard
          icon={<AlertTriangle size={20} style={{ color: '#ef4444' }} />}
          label="Outstanding Payments"
          value={formatCurrency(billingDash?.totalOutstanding || 0)}
          sub={`${billingDash?.overdueCount || 0} overdue invoices`}
          color="#ef4444"
        />
        <StatCard
          icon={<TrendingUp size={20} style={{ color: '#10b981' }} />}
          label="Collected This Month"
          value={formatCurrency(billingDash?.collectedThisMonth || 0)}
          color="#10b981"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Breed Distribution Pie */}
        <div className="card lg:col-span-1">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Animals by Breed</h3>
          {breedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={breedData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {breedData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={BREED_COLORS[index % BREED_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                />
                <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No data
            </div>
          )}
        </div>

        {/* Vaccinations Due Panel */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Vaccination Due List</h3>
            <a href="/dashboard/vaccinations" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {[
              ...(dueVaccinations?.overdue || []).map((v: any) => ({ ...v, urgency: 'overdue' })),
              ...(dueVaccinations?.today || []).map((v: any) => ({ ...v, urgency: 'today' })),
              ...(dueVaccinations?.thisWeek || []).map((v: any) => ({ ...v, urgency: 'week' })),
            ].slice(0, 8).map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: v.urgency === 'overdue' ? '#ef4444' : v.urgency === 'today' ? '#f59e0b' : '#6c47ff',
                    }}
                  />
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{v.animal?.customId} — {v.vaccineName}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.animal?.breed}</p>
                  </div>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: v.urgency === 'overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(108,71,255,0.15)',
                    color: v.urgency === 'overdue' ? '#ef4444' : '#a78bfa',
                  }}
                >
                  {formatDate(v.nextDueDate)}
                </span>
              </div>
            ))}
            {(!dueVaccinations || dueVaccinations.total === 0) && (
              <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                ✅ No vaccinations due soon
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Feed Stock */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Wheat size={15} className="text-amber-400" />
              Feed Inventory
            </h3>
            <a href="/dashboard/feed" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              Manage <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="space-y-3">
            {feedInventory.slice(0, 4).map((item: any) => {
              const pct = Math.min(100, (item.availableStock / item.quantityPurchased) * 100);
              const isLow = item.isLowStock;
              return (
                <div key={item.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={isLow ? 'text-red-400 font-medium' : 'text-gray-300'}>
                      {isLow && '⚠️ '}{item.feedType}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {item.availableStock.toFixed(0)}kg / {item.quantityPurchased.toFixed(0)}kg
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isLow ? '#ef4444' : pct > 50 ? '#10b981' : '#f59e0b',
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {feedInventory.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No feed inventory</p>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Activity size={15} className="text-emerald-400" />
              Recent Payments
            </h3>
          </div>
          <div className="space-y-2">
            {(billingDash?.recentPayments || []).slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.invoice?.customer?.name}</p>
                  <p style={{ color: 'var(--text-muted)' }}>{p.invoice?.invoiceNumber}</p>
                </div>
                <span className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</span>
              </div>
            ))}
            {(!billingDash?.recentPayments?.length) && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No recent payments</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
