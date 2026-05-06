import { APP_NAME } from '@magic-prompt/shared';
import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

import { Button } from '@/components/ui/button';
import { UserMenu } from '@/features/auth/components/user-menu';
import { Link } from '@/i18n/navigation';
import { getUser } from '@/lib/auth';

export async function Header() {
  const user = await getUser();
  const t = await getTranslations('nav');

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-base font-bold tracking-tight">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          {user ? (
            <UserMenu user={{ id: user.id, email: user.email ?? user.id }} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('signIn')}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t('signUp')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
