import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownRenderer } from '@/features/chat/components/markdown';

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders bold + italic markdown', () => {
    const { container } = render(<MarkdownRenderer content="**bold** _ital_" />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('ital');
  });

  it('renders links with target=_blank + rel=noopener noreferrer', () => {
    render(<MarkdownRenderer content="[Anthropic](https://anthropic.com)" />);
    const link = screen.getByRole('link', { name: /anthropic/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', 'https://anthropic.com');
  });

  it('renders inline code with monospace styling', () => {
    const { container } = render(<MarkdownRenderer content="run `pnpm i`" />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('pnpm i');
  });

  it('renders fenced code blocks using the CodeBlock component', () => {
    const { container } = render(<MarkdownRenderer content={'```ts\nconst x = 1;\n```'} />);
    expect(container.textContent).toContain('const x = 1;');
    // CodeBlock renders a copy button + language label.
    expect(container.textContent?.toLowerCase()).toContain('ts');
    expect(container.querySelector('button[aria-label]')).toBeTruthy();
  });

  it('does not render <script> tags from raw HTML (XSS defence)', () => {
    const { container } = render(
      <MarkdownRenderer content={'Hello<script>alert(1)</script>world'} />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('blocks javascript: links (urlTransform)', () => {
    render(<MarkdownRenderer content="[click](javascript:alert(1))" />);
    const link = screen.getByRole('link', { name: /click/i });
    expect(link.getAttribute('href')).toBe('#');
  });

  it('blocks data: links', () => {
    render(<MarkdownRenderer content="[click](data:text/html,<script>alert(1)</script>)" />);
    const link = screen.getByRole('link', { name: /click/i });
    expect(link.getAttribute('href')).toBe('#');
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const { container } = render(<MarkdownRenderer content={md} />);
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
  });

  it('renders strikethrough (GFM)', () => {
    const { container } = render(<MarkdownRenderer content="~~old~~" />);
    expect(container.querySelector('del')?.textContent).toBe('old');
  });
});
