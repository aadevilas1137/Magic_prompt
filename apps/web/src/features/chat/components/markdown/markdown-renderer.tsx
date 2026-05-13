'use client';

import DOMPurify from 'isomorphic-dompurify';
import { ExternalLink } from 'lucide-react';
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { CodeBlock } from './code-block';

import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  readonly content: string;
  readonly className?: string;
}

/**
 * Renders LLM-produced markdown safely.
 *
 * Safety posture (defence in depth):
 *   1. `react-markdown` doesn't render raw HTML by default — `<script>`,
 *      `<iframe>` etc. are escaped, not executed.
 *   2. We additionally pass content through DOMPurify before rendering.
 *      Cheap and shuts down any future regression in the parser.
 *   3. `urlTransform` blocks `javascript:`, `data:`, `vbscript:` URLs in
 *      links and images — assume LLM output is adversarial.
 *
 * Memoised on `content` so streaming re-renders don't repeat the markdown
 * → AST conversion on identical strings (the parent passes growing strings,
 * so each *new* string still rebuilds the tree — that's expected).
 */
function MarkdownRendererInner({ content, className }: MarkdownRendererProps) {
  const safe = sanitizePlaintext(content);

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-p:my-2 prose-pre:my-2 prose-headings:mt-4 prose-headings:mb-2',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
        'prose-table:my-2 prose-table:text-sm',
        'prose-a:underline-offset-2',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrl} components={MD_COMPONENTS}>
        {safe}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);

// `Components` from react-markdown is strictly typed against the html elements
// it serves. The `code` slot in particular receives an `inline` boolean that
// the upstream types treat as optional+exact — we accept that pragmatically
// via an `any`-cast at the assignment site only. Internally we keep
// our own narrow type.
interface MarkdownCodeProps {
  readonly inline?: boolean;
  readonly className?: string;
  readonly children?: React.ReactNode;
}

function CodeRenderer({ inline, className, children }: MarkdownCodeProps) {
  const match = /language-(\w+)/.exec(className ?? '');
  const text = String(children ?? '').replace(/\n$/, '');
  if (!inline && match) {
    return <CodeBlock language={match[1] ?? 'text'} value={text} />;
  }
  return (
    <code
      className={cn(
        'bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.92em]',
        className,
      )}
    >
      {children}
    </code>
  );
}

const MD_COMPONENTS: Components = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: CodeRenderer as any,
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex items-center gap-0.5 underline"
      >
        {children}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border-border bg-muted/50 border-b px-2 py-1 text-left">{children}</th>;
  },
  td({ children }) {
    return <td className="border-border border-b px-2 py-1 align-top">{children}</td>;
  },
};

function safeUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  // Block dangerous schemes outright. Allow `mailto:`, `http(s):`, fragments,
  // and protocol-relative URLs.
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return '#';
  }
  return url;
}

/**
 * Pure-text sanitisation pass. react-markdown won't render HTML by default,
 * but if someone flips the future flag we want a belt-and-braces layer.
 * `isomorphic-dompurify` runs on both server and client.
 */
function sanitizePlaintext(text: string): string {
  return DOMPurify.sanitize(text, {
    USE_PROFILES: { html: false },
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}
