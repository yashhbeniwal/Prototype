'use client';

import { useState, useEffect, useCallback } from 'react';
import { customerApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, RefreshCw, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cusRes, debtRes] = await Promise.all([
        customerApi.list({ search, sortBy, page, limit: 20 }),
        customerApi.topDebtors(5),
      ]);
      setCustomers(cusRes.data.data);
      setTotal(cusRes.data.pagination?.total || 0);
      setTopDebtors(debtRes.data.data || []);
    } catch { toast.error('Failed to load customers'); }
    finally { setIsLoading(false); }
  }, [search, sortBy, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Customer Management</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{total.toLocaleString()} customers</p>
        </div>
        <Link href="/dashboard/customers/add">
          <button id="add-customer-btn" className="btn-primary h-9">
            <Plus size={14} /> Add Customer
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="card flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search customers..."
                className="input pl-9 h-9 text-sm"
                id="customer-search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input h-9 text-sm w-40" id="customer-sort">
              <option value="name">Sort by Name</option>
              <option value="outstanding">Sort by Outstanding</option>
            </select>
            <button onClick={fetchData} className="btn-secondary h-9 px-3">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['Customer', 'Mobile', 'Country', 'Outstanding', 'Total Purchased', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4" /></td>)}
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No customers found</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{ background: 'rgba(108,71,255,0.15)', color: '#a78bfa' }}>
                            {c.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">{c.name}</p>
                            {c.gstNumber && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>GST: {c.gstNumber}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{c.mobile}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{c.country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${c.outstandingBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {formatCurrency(c.outstandingBalance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{formatCurrency(c.totalPurchased)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Link href={`/dashboard/customers/${c.id}`}>
                            <button id={`view-customer-${c.id}`} className="btn-ghost p-1.5 rounded-lg h-7 text-xs">👁</button>
                          </Link>
                          <Link href={`/dashboard/customers/${c.id}/ledger`}>
                            <button id={`ledger-${c.id}`} className="btn-ghost p-1.5 rounded-lg h-7 text-xs" title="View Ledger">
                              <ArrowUpRight size={12} />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Debtors Sidebar */}
        <div className="card h-fit">
          <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            🔴 Top Outstanding
          </h3>
          <div className="space-y-3">
            {topDebtors.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                  <div>
                    <p className="text-xs font-medium text-gray-200">{c.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.mobile}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-400">{formatCurrency(c.outstandingBalance)}</span>
              </div>
            ))}
            {!topDebtors.length && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>✅ No outstanding payments</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
