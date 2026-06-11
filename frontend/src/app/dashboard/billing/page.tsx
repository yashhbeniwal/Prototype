'use client';

import { useState, useEffect, useCallback } from 'react';
import { billingApi } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, downloadBlob } from '@/lib/utils';
import { Plus, Download, DollarSign, AlertTriangle, TrendingUp, RefreshCw, FileText, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'All') params.status = statusFilter;
      const [invRes, dashRes] = await Promise.all([
        billingApi.invoices(params),
        billingApi.dashboard(),
      ]);
      setInvoices(invRes.data.data);
      setTotal(invRes.data.pagination?.total || 0);
      setDashboard(dashRes.data.data);
    } catch { toast.error('Failed to load billing data'); }
    finally { setIsLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadPDF = async (id: string, number: string) => {
    try {
      const res = await billingApi.downloadPDF(id);
      downloadBlob(res.data, `invoice-${number}.pdf`);
    } catch { toast.error('Failed to generate PDF'); }
  };

  const statuses = ['All', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DRAFT'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Billing & Payments</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{total.toLocaleString()} invoices total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary h-9 px-3">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link href="/dashboard/billing/create">
            <button id="create-invoice-btn" className="btn-primary h-9">
              <Plus size={14} /> Create Invoice
            </button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <AlertTriangle size={18} style={{ color: '#ef4444' }} />, label: 'Outstanding', value: formatCurrency(dashboard?.totalOutstanding || 0), color: '#ef4444' },
          { icon: <FileText size={18} style={{ color: '#f59e0b' }} />, label: 'Overdue Invoices', value: dashboard?.overdueCount || 0, color: '#f59e0b' },
          { icon: <TrendingUp size={18} style={{ color: '#10b981' }} />, label: 'Collected (Month)', value: formatCurrency(dashboard?.collectedThisMonth || 0), color: '#10b981' },
          { icon: <DollarSign size={18} style={{ color: '#6c47ff' }} />, label: 'Total Invoiced', value: formatCurrency(dashboard?.totalInvoiced || 0), color: '#6c47ff' },
        ].map((s) => (
          <div key={s.label} className="card py-3" style={{ borderColor: `${s.color}30` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              {s.icon}
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            id={`filter-${s}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === s ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
            style={{
              background: statusFilter === s ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${statusFilter === s ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {['Invoice #', 'Customer', 'Amount', 'Paid', 'Balance', 'Due Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4" /></td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <p className="text-4xl mb-3">🧾</p>
                    <p className="text-sm text-gray-400">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono font-medium text-purple-400">{inv.invoiceNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-200">{inv.customer?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.customer?.mobile}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-200">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400">{formatCurrency(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-400">{formatCurrency(inv.balanceAmount)}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${getStatusColor(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/dashboard/billing/${inv.id}`}>
                          <button id={`view-inv-${inv.invoiceNumber}`} className="btn-ghost p-1.5 rounded-lg h-7 text-xs" title="View">👁</button>
                        </Link>
                        <button
                          id={`pdf-inv-${inv.invoiceNumber}`}
                          onClick={() => downloadPDF(inv.id, inv.invoiceNumber)}
                          className="btn-ghost p-1.5 rounded-lg h-7 text-xs" title="Download PDF"
                        >
                          <Download size={13} />
                        </button>
                        {inv.status !== 'PAID' && (
                          <Link href={`/dashboard/billing/${inv.id}?pay=true`}>
                            <button id={`pay-inv-${inv.invoiceNumber}`} className="btn-ghost p-1.5 rounded-lg h-7 text-xs text-emerald-400" title="Record Payment">
                              <CreditCard size={13} />
                            </button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing {(page-1)*20+1}–{Math.min(page*20, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">Previous</button>
              <button onClick={() => setPage(p => p+1)} disabled={page*20>=total} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
