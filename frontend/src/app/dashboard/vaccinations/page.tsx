'use client';

import { useState, useEffect, useCallback } from 'react';
import { vaccinationApi } from '@/lib/api';
import { formatDate, getDaysUntil, getStatusColor } from '@/lib/utils';
import { Plus, Calendar, List, Bell, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function VaccinationsPage() {
  const [dueData, setDueData] = useState<any>(null);
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarData, setCalendarData] = useState<Record<string, any[]>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dueRes, listRes] = await Promise.all([
        vaccinationApi.due({ days: 30 }),
        vaccinationApi.list({ limit: 50, status: 'PENDING' }),
      ]);
      setDueData(dueRes.data.data);
      setVaccinations(listRes.data.data);
    } catch { toast.error('Failed to load vaccinations'); }
    finally { setIsLoading(false); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    const res = await vaccinationApi.calendar(calendarMonth, calendarYear);
    setCalendarData(res.data.data || {});
  }, [calendarMonth, calendarYear]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (view === 'calendar') fetchCalendar(); }, [view, fetchCalendar]);

  const urgencyGroups = [
    { key: 'overdue', label: '🔴 Overdue', data: dueData?.overdue || [], color: '#ef4444' },
    { key: 'today', label: '🟡 Due Today', data: dueData?.today || [], color: '#f59e0b' },
    { key: 'thisWeek', label: '🔵 This Week', data: dueData?.thisWeek || [], color: '#6c47ff' },
    { key: 'later', label: '⚪ Later (30 days)', data: dueData?.later || [], color: '#6b7280' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Vaccination Management</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {dueData?.total || 0} vaccinations due in next 30 days
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {(['list', 'calendar'] as const).map((v) => (
              <button
                key={v}
                id={`view-${v}`}
                onClick={() => setView(v)}
                className="px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{ background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'white' : 'var(--text-muted)' }}
              >
                {v === 'list' ? <List size={13} /> : <Calendar size={13} />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="btn-secondary h-9 px-3">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link href="/dashboard/vaccinations/add">
            <button id="add-vaccination-btn" className="btn-primary h-9">
              <Plus size={14} /> Add Vaccination
            </button>
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {urgencyGroups.map((g) => (
          <div key={g.key} className="card py-3 text-center" style={{ borderColor: `${g.color}30` }}>
            <p className="text-2xl font-bold" style={{ color: g.color }}>{g.data.length}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{g.label.split(' ').slice(1).join(' ')}</p>
          </div>
        ))}
      </div>

      {view === 'list' ? (
        /* List View */
        <div className="space-y-4">
          {urgencyGroups.map((group) => (
            group.data.length > 0 && (
              <div key={group.key} className="card">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">{group.label} ({group.data.length})</h3>
                <div className="space-y-2">
                  {group.data.map((v: any) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.02]"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {v.animal?.customId} — {v.vaccineName}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {v.animal?.breed} • {v.disease || 'General'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-medium" style={{ color: group.color }}>
                            {group.key === 'overdue'
                              ? `${Math.abs(getDaysUntil(v.nextDueDate))}d overdue`
                              : getDaysUntil(v.nextDueDate) === 0 ? 'Today!'
                              : `${getDaysUntil(v.nextDueDate)}d left`}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDate(v.nextDueDate)}</p>
                        </div>
                        <button
                          id={`remind-${v.id}`}
                          className="btn-ghost p-1.5 rounded-lg h-7 text-xs"
                          title="Send WhatsApp Reminder"
                          onClick={() => toast.info('Reminder sent!')}
                        >
                          <Bell size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
          {dueData?.total === 0 && !isLoading && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm font-medium text-gray-400">No vaccinations due in the next 30 days</p>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">
              {new Date(calendarYear, calendarMonth - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button className="btn-secondary h-8 px-3 text-xs" onClick={() => { const d = new Date(calendarYear, calendarMonth - 2); setCalendarMonth(d.getMonth() + 1); setCalendarYear(d.getFullYear()); }}>
                ←
              </button>
              <button className="btn-secondary h-8 px-3 text-xs" onClick={() => { const d = new Date(calendarYear, calendarMonth); setCalendarMonth(d.getMonth() + 1); setCalendarYear(d.getFullYear()); }}>
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium py-2" style={{ color: 'var(--text-muted)' }}>{d}</div>
            ))}
            {(() => {
              const start = new Date(calendarYear, calendarMonth - 1, 1).getDay();
              const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
              const cells = [];
              for (let i = 0; i < start; i++) cells.push(<div key={`empty-${i}`} />);
              for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const events = calendarData[dateKey] || [];
                const isToday = new Date().toISOString().split('T')[0] === dateKey;
                cells.push(
                  <div
                    key={day}
                    className="rounded-lg p-1 min-h-[60px] text-xs"
                    style={{
                      background: events.length > 0 ? 'rgba(108, 71, 255, 0.08)' : 'var(--bg-secondary)',
                      border: `1px solid ${isToday ? 'var(--accent)' : events.length > 0 ? 'rgba(108, 71, 255, 0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <p className={`text-xs font-medium ${isToday ? 'text-purple-400' : ''}`} style={!isToday ? { color: 'var(--text-secondary)' } : {}}>{day}</p>
                    {events.slice(0, 2).map((e: any) => (
                      <div key={e.id} className="text-[10px] mt-0.5 px-1 rounded" style={{ background: 'rgba(108, 71, 255, 0.3)', color: '#c4b5fd' }}>
                        {e.animal?.customId}
                      </div>
                    ))}
                    {events.length > 2 && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>+{events.length - 2} more</p>}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
