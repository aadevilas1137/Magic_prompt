'use client';

import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { User } from '@supabase/supabase-js';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/features/auth/actions/logout';

interface UserMenuProps {
  readonly user: Pick<User, 'email' | 'id'>;
}

export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations('auth.userMenu');
  const tNav = useTranslations('nav');
  const initial = user.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={t('profile')}
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{t('signedInAs')}</p>
            <p className="text-muted-foreground truncate text-xs">{user.email ?? user.id}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>{t('profile')}</span>
          <span className="text-muted-foreground ml-auto text-xs">{t('soon')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t('settings')}</span>
          <span className="text-muted-foreground ml-auto text-xs">{t('soon')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{tNav('logout')}</span>
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
