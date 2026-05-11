'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { cn } from '@/lib/utils';

interface CodeBlockProps {
  readonly language: string;
  readonly value: string;
}

/**
 * Code block with language badge + copy-to-clipboard button.
 * Falls back to `text` when the language can't be detected. We use Prism
 * (not hljs) for the broader language pack + smaller bundle when tree-shaken.
 */
export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard write can fail in iframes without permissions — silent */
    }
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-md border bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-xs">
        <span className="font-mono uppercase tracking-wide text-zinc-400">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 transition',
            'hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-100',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={oneDark as any}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '0.75rem 1rem',
          background: 'transparent',
          fontSize: '0.875rem',
          lineHeight: '1.55',
        }}
        codeTagProps={{ className: 'font-mono' }}
      >
        {value.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
}
