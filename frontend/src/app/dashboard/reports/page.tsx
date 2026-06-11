'use client';

import { useState } from 'react';
import { reportApi } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';
import { FileDown, BarChart3, Users, Syringe, Dog, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

type ReportType = 'animals' | 'vaccinations' | 'outstanding' | 'profitability';

interface ReportConfig {
  key: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  formats: ('json' | 'pdf' | 'excel')[];
}

const reports: ReportConfig[] = [
  {
    key: 'animals',
    title: 'Animal Report',
    description: 'Complete list of all animals with health, breed, and status information.',
    icon: <Dog size={20} />,
    color: '#6c47ff',
    formats: ['excel', 'pdf'],
  },
  {
    key: 'vaccinations',
    title: 'Vaccination Report',
    description: 'All vaccination records with due dates, status, and batch information.',
    icon: <Syringe size={20} />,
    color: '#f59e0b',
    formats: ['excel'],
  },
  {
    key: 'outstanding',
    title: 'Customer Outstanding Report',
    description: 'Customers with unpaid/overdue invoices and outstanding balance details.',
    icon: <Users size={20} />,
    color: '#ef4444',
    formats: ['excel', 'pdf'],
  },
  {
    key: 'profitability',
    title: 'Profitability Report',
    description: 'Revenue vs expense analysis with profit per breed and farm profitability.',
    icon: <TrendingUp size={20} />,
    color: '#10b981',
    formats: ['json'],
  },
];

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const generateReport = async (key: ReportType, format: string) => {
    setLoading(`${key}-${format}`);
    try {
      let res: any;
      const params: any = { format };

      if (key === 'animals') res = await reportApi.animals(params);
      else if (key === 'vaccinations') res = await reportApi.vaccinations(params);
      else if (key === 'outstanding') res = await reportApi.outstanding(params);
      else if (key === 'profitability') res = await reportApi.profitability(params);

      if (format === 'excel') {
        downloadBlob(res.data, `${key}-report.xlsx`);
        toast.success('Excel report downloaded!');
      } else if (format === 'pdf') {
        downloadBlob(res.data, `${key}-report.pdf`);
        toast.success('PDF report downloaded!');
      } else {
        const dataStr = JSON.stringify(res.data.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        downloadBlob(blob, `${key}-report.json`);
        toast.success('JSON report downloaded!');
      }
    } catch (err: any) {
      toast.error(`Failed to generate ${key} report`);
    } finally {
      setLoading(null);
    }
  };

  const formatLabel: Record<string, string> = {
    excel: '📊 Excel',
    pdf: '📄 PDF',
    json: '🔤 JSON',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Generate and download comprehensive farm reports
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map((report) => (
          <div
            key={report.key}
            className="card hover-lift"
            style={{ borderColor: `${report.color}20` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${report.color}15`, color: report.color, border: `1px solid ${report.color}30` }}
              >
                {report.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-200">{report.title}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.description}</p>

                <div className="flex gap-2 mt-4">
                  {report.formats.map((fmt) => (
                    <button
                      key={fmt}
                      id={`report-${report.key}-${fmt}`}
                      onClick={() => generateReport(report.key, fmt)}
                      disabled={loading === `${report.key}-${fmt}`}
                      className="btn-secondary h-8 px-3 text-xs gap-1.5 disabled:opacity-50"
                    >
                      {loading === `${report.key}-${fmt}` ? (
                        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileDown size={12} />
                      )}
                      {formatLabel[fmt]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-purple-400" />
          Report Guidelines
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="font-medium text-gray-300 mb-1">📊 Excel Reports</p>
            <p>Formatted spreadsheets with headers, auto-fitted columns, and highlighted headers. Best for data analysis.</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="font-medium text-gray-300 mb-1">📄 PDF Reports</p>
            <p>Professional printable reports with your farm name and GST details. Best for sharing with clients.</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="font-medium text-gray-300 mb-1">🔗 API Integration</p>
            <p>Use JSON format to integrate with external ERP, accounting, or government systems via REST API.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
