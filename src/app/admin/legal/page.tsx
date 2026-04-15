'use client';

import { useEffect, useState } from 'react';
import { listCmsPages, upsertCmsPage, deleteCmsPage, type CmsPage } from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge } from '@/components/ui';
import { PlusIcon, EditIcon, TrashIcon, CloseIcon, RefreshIcon, EyeIcon } from '@/components/ui/icons';

const DEFAULT_PAGES = [
  { slug: 'privacy', title: 'Privacy Policy', sortOrder: 1 },
  { slug: 'terms', title: 'Terms of Service', sortOrder: 2 },
  { slug: 'cookies', title: 'Cookie Policy', sortOrder: 3 },
];

export default function AdminLegalPage() {
  const toast = useToast();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listCmsPages('legal');
      setPages(res.pages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const seedDefaults = async () => {
    for (const p of DEFAULT_PAGES) {
      if (!pages.find((pg) => pg.slug === p.slug)) {
        await upsertCmsPage({
          slug: p.slug,
          title: p.title,
          category: 'legal',
          content: `<h1>${p.title}</h1><p>Last updated: ${new Date().toLocaleDateString()}</p><p>Edit this content from the admin panel.</p>`,
          sortOrder: p.sortOrder,
        });
      }
    }
    toast.success('Default legal pages created');
    await load();
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Delete this page?')) return;
    try {
      await deleteCmsPage(slug);
      toast.success('Page deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Legal Pages</h1>
          <p className="text-sm text-zinc-400">Privacy Policy, Terms of Service, Cookie Policy</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50">
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {pages.length === 0 && !loading && (
            <Button onClick={seedDefaults} variant="outline">Create defaults</Button>
          )}
          <Button onClick={() => setCreating(true)} icon={<PlusIcon className="w-4 h-4" />}>New page</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-zinc-900/50 rounded-xl animate-pulse" />)}
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-12 text-center text-sm text-zinc-500">
          No legal pages yet. Click &quot;Create defaults&quot; to set up Privacy, Terms, and Cookies.
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 flex items-center justify-between hover:border-white/20 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-semibold text-white">{page.title}</h3>
                  <Badge variant={page.isPublished ? 'success' : 'default'} size="sm">
                    {page.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 font-mono">/{page.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <a href={`/${page.slug}`} target="_blank" className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Preview">
                  <EyeIcon className="w-4 h-4" />
                </a>
                <button onClick={() => setEditing(page)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Edit">
                  <EditIcon className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(page.slug)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <CmsEditor
          page={editing}
          category="legal"
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={async () => { setEditing(null); setCreating(false); await load(); }}
        />
      )}
    </>
  );
}

function CmsEditor({ page, category, onClose, onSaved }: { page: CmsPage | null; category: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [slug, setSlug] = useState(page?.slug || '');
  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? true);
  const [sortOrder, setSortOrder] = useState(page?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleSave = async () => {
    if (!slug.trim() || !title.trim()) { toast.error('Slug and title are required'); return; }
    try {
      setSaving(true);
      await upsertCmsPage({ slug: slug.toLowerCase(), title, category, content, isPublished, sortOrder });
      toast.success('Page saved');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{page ? 'Edit page' : 'Create page'}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreview(!preview)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${preview ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:text-white'}`}>
              {preview ? 'Editor' : 'Preview'}
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><CloseIcon className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!preview ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Slug</label>
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="privacy" disabled={!!page} className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm font-mono focus:outline-none disabled:opacity-50" />
                </div>
                <div><label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Privacy Policy" className="w-full px-3 py-2.5 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/60" /> Published
                </label>
                <div><label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Order</label>
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-16 px-2 py-1 bg-black/60 border border-white/10 rounded-lg text-white text-sm focus:outline-none" />
                </div>
              </div>
              <div><label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Content (HTML)</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} placeholder="<h1>Privacy Policy</h1><p>...</p>" className="w-full px-4 py-3 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm font-mono focus:outline-none resize-none leading-relaxed" />
              </div>
            </>
          ) : (
            <div className="bg-black/40 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</h2>
              <div className="prose prose-invert prose-sm max-w-none text-zinc-300 [&_h1]:text-white [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-white [&_h3]:text-lg [&_a]:text-blue-400 [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-white/10">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
