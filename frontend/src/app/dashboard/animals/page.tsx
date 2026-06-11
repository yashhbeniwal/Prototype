'use client';

import { useState, useEffect, useCallback } from 'react';
import { animalApi } from '@/lib/api';
import { formatDate, calculateAge, getStatusColor, cn } from '@/lib/utils';
import { Plus, Search, Filter, QrCode, RefreshCw, Dog, Eye, Edit2, Archive, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const BREEDS = ['All', 'Boer', 'Jamnapari', 'Beetal', 'Black Bengal', 'Osmanabadi', 'Sirohi', 'Other'];
const STATUSES = ['All', 'ACTIVE', 'SOLD', 'DECEASED', 'QUARANTINED', 'TRANSFERRED'];

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [breed, setBreed] = useState('All');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchAnimals = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (breed !== 'All') params.breed = breed;
      if (status !== 'All') params.status = status;

      const res = await animalApi.list(params);
      setAnimals(res.data.data);
      setTotal(res.data.pagination.total);
    } catch {
      toast.error('Failed to load animals');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, breed, status]);

  useEffect(() => {
    const timer = setTimeout(fetchAnimals, 300);
    return () => clearTimeout(timer);
  }, [fetchAnimals]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Animal Management</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString()} animals total
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAnimals} className="btn-secondary h-10 px-3" title="Refresh">
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <Link href="/dashboard/animals/add">
            <button id="add-animal-btn" className="btn-primary h-10">
              <Plus size={16} />
              Add Animal
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by ID, name, breed..."
              className="input pl-9 h-9 text-sm"
              id="animal-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input h-9 text-sm w-36"
            id="status-filter"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Status' : s}</option>)}
          </select>

          {/* Breed filter */}
          <select
            value={breed}
            onChange={(e) => { setBreed(e.target.value); setPage(1); }}
            className="input h-9 text-sm w-40"
            id="breed-filter"
          >
            {BREEDS.map((b) => <option key={b} value={b}>{b === 'All' ? 'All Breeds' : b}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {['Animal ID', 'Name / Breed', 'Age / Weight', 'Gender', 'Location', 'Status', 'Vaccinations', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : animals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="text-4xl mb-3">🐐</div>
                    <p className="text-sm font-medium text-gray-400">No animals found</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {search ? 'Try different search terms' : 'Add your first animal to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                animals.map((animal) => (
                  <tr
                    key={animal.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {/* Animal ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(108, 71, 255, 0.15)', color: '#a78bfa' }}
                        >
                          {animal.customId.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-mono font-medium text-purple-400">{animal.customId}</span>
                          {animal.rfidTag && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>RFID: {animal.rfidTag}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Name / Breed */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-200">{animal.name || '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{animal.breed}</p>
                    </td>
                    {/* Age / Weight */}
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <p>{calculateAge(animal.dateOfBirth)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{animal.weight}kg</p>
                    </td>
                    {/* Gender */}
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {animal.gender === 'MALE' ? '♂ Male' : '♀ Female'}
                    </td>
                    {/* Location */}
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {animal.location || '—'}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${getStatusColor(animal.status)}`}>
                        {animal.status}
                      </span>
                    </td>
                    {/* Vaccinations */}
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {animal._count?.vaccinations || 0} records
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/animals/${animal.id}`}>
                          <button id={`view-animal-${animal.customId}`} className="btn-ghost p-1.5 h-7 w-7 rounded-lg" title="View">
                            <Eye size={13} />
                          </button>
                        </Link>
                        <Link href={`/dashboard/animals/${animal.id}/edit`}>
                          <button id={`edit-animal-${animal.customId}`} className="btn-ghost p-1.5 h-7 w-7 rounded-lg" title="Edit">
                            <Edit2 size={13} />
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

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">
                Previous
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-secondary h-8 px-3 text-xs disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
