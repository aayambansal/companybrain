'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

export function BackupSection() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      const data = await api.get<unknown>('/v1/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'companybrain-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('success', 'Export downloaded.');
    } catch {
      toast('error', 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { memories?: unknown[] };
      const memories = Array.isArray(parsed) ? parsed : parsed.memories;
      if (!Array.isArray(memories)) throw new Error('bad shape');
      const r = await api.post<{ imported: number; failed: number }>('/v1/backup/import', {
        memories,
        dedupe: true,
      });
      toast('success', `Imported ${r.imported} memories${r.failed ? `, ${r.failed} failed` : ''}.`);
    } catch {
      toast('error', 'Import failed. Expected a CompanyBrain export JSON.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium text-ink-muted">Backup</h2>
      <p className="mb-3 text-[13px] text-ink-faint">
        Export every memory as JSON, or import from a previous export.
      </p>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-[13px] text-ink-muted">Your data, portable. Nothing is locked in.</p>
        <div className="flex items-center gap-2">
          <label
            className={`inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${importing ? 'pointer-events-none opacity-50' : ''}`}
          >
            {importing ? 'Importing…' : 'Import'}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = '';
              }}
            />
          </label>
          <Button variant="secondary" size="sm" onClick={exportAll} loading={exporting}>
            Export all
          </Button>
        </div>
      </div>
    </section>
  );
}
