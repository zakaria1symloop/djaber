'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

export default function CmsPageView({ slug }: { slug: string }) {
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/cms/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => setPage(d.page))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen pt-28 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-10 w-64 bg-white/5 rounded animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${60 + i * 5}%` }} />)}
          </div>
        </div>
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="min-h-screen pt-28 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Page Not Found</h1>
          <p className="text-zinc-400 mb-6">This page hasn&apos;t been published yet.</p>
          <Link href="/" className="text-white underline hover:text-zinc-300">Go home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-28 pb-20 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1
          className="text-3xl sm:text-4xl font-bold text-white mb-8"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {page.title}
        </h1>
        <div
          className="prose prose-invert prose-lg max-w-none text-zinc-300 leading-relaxed
            [&_h1]:text-white [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-8
            [&_h2]:text-white [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6
            [&_h3]:text-white [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4
            [&_p]:mb-4 [&_p]:text-zinc-300
            [&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-300
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
            [&_li]:mb-1 [&_li]:text-zinc-300
            [&_strong]:text-white [&_strong]:font-semibold
            [&_blockquote]:border-l-4 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-400
            [&_table]:w-full [&_th]:text-left [&_th]:text-white [&_th]:pb-2 [&_td]:py-2 [&_td]:border-t [&_td]:border-white/10"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </div>
    </main>
  );
}
