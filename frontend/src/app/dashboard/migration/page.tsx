'use client';

import { useState, useCallback } from 'react';
import { feedApi } from '@/lib/api';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

export default function MigrationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('EXCEL');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    const res = await api.get('/migration/jobs');
    setJobs(res.data.data || []);
  };

  useState(() => { fetchJobs(); });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const uploadFile = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileType);

      const res = await api.post('/migration/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setJobId(res.data.data.jobId);
      toast.success('Migration started! Tracking progress...');
      fetchJobs();

      // Poll for status
      const poll = setInterval(async () => {
        const statusRes = await api.get(`/migration/jobs/${res.data.data.jobId}`);
        setJobStatus(statusRes.data.data);
        if (['COMPLETED', 'FAILED'].includes(statusRes.data.data.status)) {
          clearInterval(poll);
          fetchJobs();
        }
      }, 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const supportedFormats = [
    { type: 'EXCEL', icon: '📊', label: 'Excel (.xlsx)', desc: 'Column headers: Animal ID, Name, Breed, Gender, DOB, Weight, Location, Purchase Cost' },
    { type: 'CSV', icon: '📄', label: 'CSV (.csv)', desc: 'Same column format as Excel, comma-separated values' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white">Data Migration</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Import historical records from Excel, CSV, or WhatsApp exports
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload Area */}
        <div className="space-y-4">
          {/* File Type */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Select File Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {supportedFormats.map((f) => (
                <button
                  key={f.type}
                  id={`type-${f.type}`}
                  onClick={() => setFileType(f.type)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: fileType === f.type ? 'rgba(108, 71, 255, 0.1)' : 'var(--bg-secondary)',
                    border: `1px solid ${fileType === f.type ? 'rgba(108, 71, 255, 0.5)' : 'var(--border)'}`,
                  }}
                >
                  <p className="text-xl mb-1">{f.icon}</p>
                  <p className="text-xs font-medium text-gray-200">{f.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className="rounded-2xl p-8 text-center transition-all cursor-pointer"
            style={{
              background: isDragging ? 'rgba(108, 71, 255, 0.05)' : 'var(--bg-secondary)',
              border: `2px dashed ${isDragging ? 'var(--accent)' : file ? '#10b981' : 'var(--border)'}`,
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div>
                <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-200">{file.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB • Click to change
                </p>
              </div>
            ) : (
              <div>
                <Upload size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium text-gray-300">Drop your file here</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>or click to browse</p>
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Supports .xlsx, .xls, .csv</p>
              </div>
            )}
          </div>

          <button
            id="upload-migrate-btn"
            onClick={uploadFile}
            disabled={!file || isUploading}
            className="btn-primary w-full h-11 disabled:opacity-50"
          >
            {isUploading ? (
              <><Loader2 size={16} className="animate-spin" /> Processing...</>
            ) : (
              <><Upload size={16} /> Start Migration</>
            )}
          </button>
        </div>

        {/* Status & History */}
        <div className="space-y-4">
          {/* Current Job Status */}
          {jobStatus && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Migration Progress</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <span className={`font-medium ${
                    jobStatus.status === 'COMPLETED' ? 'text-emerald-400' :
                    jobStatus.status === 'FAILED' ? 'text-red-400' : 'text-yellow-400'
                  }`}>{jobStatus.status}</span>
                </div>
                {jobStatus.totalRows > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Processed</span>
                      <span className="text-gray-200">{jobStatus.processedRows || 0} / {jobStatus.totalRows}</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${((jobStatus.processedRows || 0) / jobStatus.totalRows) * 100}%`,
                          background: jobStatus.status === 'FAILED' ? '#ef4444' : 'var(--accent)',
                        }}
                      />
                    </div>
                  </>
                )}
                {jobStatus.errorRows > 0 && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle size={12} /> {jobStatus.errorRows} rows failed to import
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Column Format Guide */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <FileText size={14} className="text-purple-400" /> Required Column Format
            </h3>
            <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {[
                { col: 'Animal ID', req: true, desc: 'Unique ID e.g. G001' },
                { col: 'Breed', req: true, desc: 'Boer, Jamnapari, etc.' },
                { col: 'Gender', req: true, desc: 'MALE or FEMALE' },
                { col: 'DOB', req: true, desc: 'Date of birth (DD/MM/YYYY)' },
                { col: 'Weight', req: false, desc: 'Current weight in kg' },
                { col: 'Name', req: false, desc: 'Animal name' },
                { col: 'Location', req: false, desc: 'Pen/Shed identifier' },
                { col: 'Purchase Cost', req: false, desc: 'Amount in ₹' },
              ].map((c) => (
                <div key={c.col} className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <code className="text-purple-400 font-mono">{c.col}</code>
                  {c.req && <span className="text-red-400 text-[10px]">*</span>}
                  <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Past Jobs */}
          {jobs.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Recent Migrations</h3>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between text-xs py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p className="text-gray-300">{job.fileName}</p>
                      <p style={{ color: 'var(--text-muted)' }}>{job.type} • {new Date(job.createdAt).toLocaleString('en-IN')}</p>
                    </div>
                    <span className={`badge ${
                      job.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-400/10' :
                      job.status === 'FAILED' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'
                    }`}>
                      {job.processedRows || 0} rows
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
