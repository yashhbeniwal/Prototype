'use client';

import { useState, useEffect, useCallback } from 'react';
import { medicalApi } from '@/lib/api';
import { formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Search, Filter, Stethoscope, RefreshCw, Eye } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function MedicalHistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('All');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.animalId = search; // simple search assuming animal ID input
      if (resolvedFilter !== 'All') params.isResolved = resolvedFilter === 'Resolved';
      
      const res = await medicalApi.list(params);
      setRecords(res.data.data);
      setTotal(res.data.pagination.total);
    } catch { toast.error('Failed to load medical records'); }
    finally { setIsLoading(false); }
  }, [page, search, resolvedFilter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Medical Records</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString()} records
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary h-10 px-3">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link href="/dashboard/health/add">
            <button className="btn-primary h-10">
              <Plus size={16} /> Add Record
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by Animal ID..."
            className="input pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={resolvedFilter}
          onChange={(e) => { setResolvedFilter(e.target.value); setPage(1); }}
          className="input h-9 text-sm w-40"
        >
          <option value="All">All Statuses</option>
          <option value="Resolved">Resolved</option>
          <option value="Active">Active</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {['Animal', 'Disease', 'Diagnosis', 'Veterinarian', 'Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4" /></td>)}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Stethoscope size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-medium text-gray-400">No medical records found</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-purple-400">{r.animal?.customId}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.animal?.breed}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200 font-medium">{r.disease}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <p className="truncate max-w-[200px]" title={r.diagnosis}>{r.diagnosis}</p>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.veterinarian?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${r.isResolved ? 'text-emerald-400 bg-emerald-400/10' : 'text-orange-400 bg-orange-400/10'}`}>
                        {r.isResolved ? 'Resolved' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/health/${r.id}`}>
                        <button className="btn-ghost p-1.5 h-7 rounded-lg text-xs">
                          <Eye size={14} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
