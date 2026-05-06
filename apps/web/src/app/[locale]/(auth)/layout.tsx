import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
      {children}
    </main>
  );
}
