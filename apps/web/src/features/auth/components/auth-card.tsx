import { APP_NAME } from '@magic-prompt/shared';
import Link from 'next/link';

import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AuthCardProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function AuthCard({ title, description, children, footer, className }: AuthCardProps) {
  return (
    <div className={cn('w-full max-w-md', className)}>
      <Link href="/" className="mb-8 block text-center text-2xl font-bold tracking-tight">
        {APP_NAME}
      </Link>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer ? (
        <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>
      ) : null}
    </div>
  );
}
