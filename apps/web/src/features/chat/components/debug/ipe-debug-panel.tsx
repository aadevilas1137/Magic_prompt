'use client';

import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';

import type { IPEDebugRow } from '@/features/chat/queries/get-ipe-debug';

import { cn } from '@/lib/utils';

interface IPEDebugPanelProps {
  readonly rows: readonly IPEDebugRow[];
  readonly chatId: string;
}

/**
 * Right-side slide-out debug panel showing the IPE pipeline output for each
 * assistant turn in the chat. Admin-only — the page must check `isIPEAdmin()`
 * before rendering this component. The data passed here already comes from
 * an admin-gated server fetch.
 *
 * Visual: dark theme regardless of app theme (debug-tool aesthetic), monospace
 * for prompts/JSON, copy buttons on every section, sections collapsible.
 */
export function IPEDebugPanel({ rows, chatId }: IPEDebugPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle IPE debug panel"
        className={cn(
          'fixed bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full',
          'bg-zinc-900 px-4 font-mono text-xs text-zinc-100 shadow-lg hover:bg-zinc-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        )}
        data-testid="ipe-debug-toggle"
      >
        🪄 {open ? 'Close' : 'Show'} IPE ({rows.length})
      </button>

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-2xl transform transition-transform duration-300',
          'bg-zinc-950 text-zinc-100 shadow-2xl',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
        data-testid="ipe-debug-panel"
      >
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
          <h2 className="font-mono text-sm font-semibold">IPE debug — chat {chatId.slice(0, 8)}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close panel"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-3rem)] overflow-y-auto px-4 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No IPE rows yet for this chat. Send a message with IPE_ENABLED=true.
            </p>
          ) : (
            <div className="space-y-6">
              {rows.map((row) => (
                <IPEDebugRowCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function IPEDebugRowCard({ row }: { row: IPEDebugRow }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-3" data-testid="ipe-debug-row">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
        <Pill>{row.primaryDomain ?? 'no-domain'}</Pill>
        {row.secondaryDomain && <Pill>{row.secondaryDomain}</Pill>}
        <Pill>{row.complexityScore ?? 'n/a'}</Pill>
        {row.fallbackUsed && <Pill className="bg-amber-900 text-amber-100">fallback</Pill>}
        {row.qualityScore !== null && (
          <Pill
            className={cn(
              row.qualityScore >= 80
                ? 'bg-green-900 text-green-100'
                : row.qualityScore >= 50
                  ? 'bg-yellow-900 text-yellow-100'
                  : 'bg-red-900 text-red-100',
            )}
          >
            quality {row.qualityScore} ({row.qualityMethod})
          </Pill>
        )}
        <Pill>{row.pipelineVersion}</Pill>
        <span className="ml-auto">{new Date(row.createdAt).toLocaleString()}</span>
      </div>

      <Section label="Original input">
        <pre className="whitespace-pre-wrap break-words">{row.originalInput}</pre>
      </Section>

      <Section label="Intent (Layer 1)">
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(row.intentJson, null, 2)}
        </pre>
      </Section>

      <Section label="Classifier (Layer 2)">
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(row.classifierJson, null, 2)}
        </pre>
      </Section>

      <Section label="Magic prompt (Layer 3)">
        <pre className="whitespace-pre-wrap break-words">{row.magicPrompt}</pre>
      </Section>

      <Section label="Layer latencies (ms)">
        <pre className="whitespace-pre-wrap break-words">
          {JSON.stringify(row.layerLatenciesMs, null, 2)}
        </pre>
      </Section>

      {row.error && (
        <Section label="Error">
          <pre className="whitespace-pre-wrap break-words text-red-300">{row.error}</pre>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const text =
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : extractText(children);
  return (
    <details className="group mt-2 rounded bg-zinc-950/60">
      <summary className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs font-semibold hover:bg-zinc-800">
        <span>{label}</span>
        <CopyButton text={text} />
      </summary>
      <div className="px-2 py-2 font-mono text-[11px] leading-relaxed text-zinc-200">
        {children}
      </div>
    </details>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return props ? extractText(props.children) : '';
  }
  return '';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard write may fail in restricted contexts */
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={copied ? 'Copied' : 'Copy section'}
      className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-700"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}
