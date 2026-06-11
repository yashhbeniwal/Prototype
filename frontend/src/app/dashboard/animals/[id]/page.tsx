'use client';

import { useState, useEffect, use } from 'react';
import { animalApi, vaccinationApi, medicalApi } from '@/lib/api';
import { formatDate, formatCurrency, calculateAge, getStatusColor } from '@/lib/utils';
import { ArrowLeft, Syringe, Stethoscope, Scale, Activity, Image as ImgIcon, QrCode, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type Tab = 'overview' | 'vaccinations' | 'medical' | 'feed' | 'costing' | 'timeline';

export default function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [animal, setAnimal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    animalApi.get(id).then((res) => {
      setAnimal(res.data.data);
    }).catch(() => toast.error('Animal not found'))
    .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return <div className="card h-96 shimmer" />;
  }

  if (!animal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Animal not found</p>
        <Link href="/dashboard/animals"><button className="btn-primary mt-4">Back to Animals</button></Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={14} /> },
    { key: 'vaccinations', label: `Vaccinations (${animal.vaccinations?.length || 0})`, icon: <Syringe size={14} /> },
    { key: 'medical', label: `Medical (${animal.medicalHistory?.length || 0})`, icon: <Stethoscope size={14} /> },
    { key: 'feed', label: 'Feed', icon: '🌾' },
    { key: 'costing', label: 'Costing', icon: '₹' },
    { key: 'timeline', label: 'Timeline', icon: <Activity size={14} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/animals">
            <button className="btn-secondary h-9 w-9 p-0 rounded-xl">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{animal.customId}</h2>
              <span className={`badge ${getStatusColor(animal.status)}`}>{animal.status}</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {animal.name || 'No name'} • {animal.breed} • {animal.gender}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/animals/${id}/edit`}>
            <button className="btn-secondary h-9">
              <Edit2 size={14} /> Edit
            </button>
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Age', value: calculateAge(animal.dateOfBirth) },
          { label: 'Weight', value: `${animal.weight}kg` },
          { label: 'Location', value: animal.location || '—' },
          { label: 'Purchase Cost', value: animal.purchaseCost ? formatCurrency(animal.purchaseCost) : '—' },
        ].map((s) => (
          <div key={s.label} className="card py-3 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-lg font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Animal Details</h3>
            {[
              { label: 'Animal ID', value: animal.customId },
              { label: 'RFID Tag', value: animal.rfidTag || '—' },
              { label: 'Breed', value: animal.breed },
              { label: 'Gender', value: animal.gender },
              { label: 'Color', value: animal.color || '—' },
              { label: 'Markings', value: animal.markings || '—' },
              { label: 'Date of Birth', value: formatDate(animal.dateOfBirth) },
              { label: 'Purchase Date', value: animal.purchaseDate ? formatDate(animal.purchaseDate) : '—' },
              { label: 'Mother ID', value: animal.motherCustomId || '—' },
              { label: 'Father ID', value: animal.fatherCustomId || '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <span className="font-medium text-gray-200">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Images */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Photos</h3>
            {animal.images && animal.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {animal.images.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Animal ${animal.customId}`} className="w-full h-24 object-cover rounded-xl" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="h-36 flex flex-col items-center justify-center rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
                <ImgIcon size={28} style={{ color: 'var(--text-muted)' }} />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>No photos added</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'vaccinations' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Vaccination History</h3>
            <Link href={`/dashboard/vaccinations/add?animalId=${id}`}>
              <button className="btn-primary h-8 text-xs">+ Add Vaccination</button>
            </Link>
          </div>
          {(animal.vaccinations || []).map((v: any) => (
            <div key={v.id} className="flex items-start justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium text-gray-200">{v.vaccineName}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Given: {v.dateGiven ? formatDate(v.dateGiven) : 'Not yet'} • Next: {formatDate(v.nextDueDate)}
                </p>
                {v.batchNumber && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Batch: {v.batchNumber}</p>}
              </div>
              <span className={`badge text-xs ${getStatusColor(v.status)}`}>{v.status}</span>
            </div>
          ))}
          {!animal.vaccinations?.length && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No vaccination records</p>
          )}
        </div>
      )}

      {tab === 'medical' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Medical History</h3>
            <Link href={`/dashboard/health/add?animalId=${id}`}>
              <button className="btn-primary h-8 text-xs">+ Add Record</button>
            </Link>
          </div>
          {(animal.medicalHistory || []).map((m: any) => (
            <div key={m.id} className="px-4 py-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-200">{m.disease}</p>
                <span className={`badge text-xs ${m.isResolved ? 'text-emerald-400 bg-emerald-400/10' : 'text-orange-400 bg-orange-400/10'}`}>
                  {m.isResolved ? 'Resolved' : 'Active'}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.diagnosis}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatDate(m.date)}</p>
            </div>
          ))}
          {!animal.medicalHistory?.length && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No medical records</p>
          )}
        </div>
      )}

      {tab === 'costing' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Expenses', value: formatCurrency(animal.profitability?.totalExpenses || 0), color: '#ef4444' },
            { label: 'Total Revenue', value: formatCurrency(animal.profitability?.totalRevenue || 0), color: '#10b981' },
            { label: 'Net Profit', value: formatCurrency(animal.profitability?.netProfit || 0), color: animal.profitability?.netProfit >= 0 ? '#10b981' : '#ef4444' },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Activity Timeline</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />
            <div className="space-y-4 pl-10">
              {(animal.activityLogs || []).map((log: any) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-7 w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: 'var(--accent)', border: '2px solid var(--bg-primary)' }} />
                  <p className="text-xs font-medium text-gray-200">{log.description}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDate(log.createdAt)}</p>
                </div>
              ))}
              {!animal.activityLogs?.length && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
