'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  LogOut,
  Menu,
  ScrollText,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface ShellActor {
  kind: 'user' | 'guest';
  displayName: string;
  roleLabel: string;
  role: 'admin' | 'gm' | 'player' | 'guest';
  guestCampaignId?: string;
}

interface AppShellProps {
  actor: ShellActor;
  pageTitle?: string;
  pageSubtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'rol_sidebar_collapsed';

export function AppShell({
  actor,
  pageTitle,
  pageSubtitle,
  headerActions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === '1') {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  const navItems: Array<{
    href: string;
    label: string;
    icon: typeof Compass;
    active: boolean;
  }> = [];

  if (actor.role === 'admin') {
    navItems.push({
      href: '/admin',
      label: 'Administració',
      icon: Shield,
      active: pathname.startsWith('/admin'),
    });
  } else if (actor.role === 'gm') {
    navItems.push({
      href: '/campaigns',
      label: 'Campanyes',
      icon: Compass,
      active: pathname.startsWith('/campaigns'),
    });
    navItems.push({
      href: '/campaigns?tab=trash',
      label: 'Paperera (30 dies)',
      icon: Trash2,
      active: false,
    });
  } else if (actor.role === 'player') {
    navItems.push({
      href: '/campaigns',
      label: 'Les meves campanyes',
      icon: Compass,
      active: pathname.startsWith('/campaigns'),
    });
  } else if (actor.role === 'guest' && actor.guestCampaignId) {
    navItems.push({
      href: `/campaigns/${actor.guestCampaignId}`,
      label: 'La meva campanya',
      icon: Compass,
      active: pathname.startsWith('/campaigns'),
    });
  }

  const upcomingItems = [
    { label: 'Fitxes D&D 5e', phase: 'Fase 3', icon: Users },
    { label: 'Biblioteca i manuals', phase: 'Fase 4', icon: BookOpen },
  ];

  function renderSidebarContent(isMobile: boolean) {
    const isCollapsed = !isMobile && collapsed;

    return (
      <div className="flex h-full flex-col justify-between bg-[var(--rol-bg-sidebar)] text-[var(--rol-ink-on-dark)] border-r border-[var(--rol-border-dark)]">
        <div>
          {/* Capçalera marca */}
          <div className="flex items-center justify-between border-b border-[var(--rol-border-dark)] px-4 py-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 overflow-hidden"
              onClick={() => isMobile && setMobileOpen(false)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--rol-radius-md)] border border-[var(--rol-accent-gold)] bg-[var(--rol-accent-primary)] text-[var(--rol-accent-primary-ink)]">
                <ScrollText className="h-5 w-5" />
              </span>
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="rol-heading-flourish block text-lg font-bold tracking-wide text-[var(--rol-ink-on-dark)]">
                    Rol
                  </span>
                  <span className="block truncate text-[11px] text-[var(--rol-ink-on-dark-muted)]">
                    Crònica de taula
                  </span>
                </div>
              )}
            </Link>

            {isMobile ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tancar el menú"
                className="rounded-md p-1.5 text-[var(--rol-ink-on-dark-muted)] hover:bg-[var(--rol-bg-sidebar-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleCollapsed}
                title={isCollapsed ? 'Desplegar el menú' : 'Plegar el menú'}
                aria-label={isCollapsed ? 'Desplegar el menú' : 'Plegar el menú'}
                className="rounded-md p-1.5 text-[var(--rol-ink-on-dark-muted)] hover:bg-[var(--rol-bg-sidebar-hover)] hover:text-[var(--rol-ink-on-dark)] cursor-pointer"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Navegació activa */}
          <nav className="space-y-1 p-3" aria-label="Navegació principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-[var(--rol-radius-md)] px-3 py-2.5 text-sm font-medium transition-colors ${
                    item.active
                      ? 'bg-[var(--rol-bg-sidebar-active)] text-[var(--rol-ink-on-dark)] border border-[var(--rol-accent-gold)]/40'
                      : 'text-[var(--rol-ink-on-dark-muted)] hover:bg-[var(--rol-bg-sidebar-hover)] hover:text-[var(--rol-ink-on-dark)]'
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Elements planificats (sense botons falsos) */}
          {actor.role !== 'admin' && (
            <div className="mt-2 border-t border-[var(--rol-border-dark)] px-3 pt-3">
              {!isCollapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--rol-ink-on-dark-muted)]/70">
                  Properes fases
                </p>
              )}
              <div className="space-y-1">
                {upcomingItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      title={`${item.label} (${item.phase} — pendent)`}
                      aria-disabled="true"
                      className={`flex items-center justify-between gap-2 rounded-[var(--rol-radius-md)] px-3 py-2 text-xs text-[var(--rol-ink-on-dark-muted)]/60 ${
                        isCollapsed ? 'justify-center px-2' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </span>
                      {!isCollapsed && (
                        <span className="rounded bg-[var(--rol-bg-sidebar-hover)] px-1.5 py-0.5 text-[10px]">
                          {item.phase}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Peu d'usuari i tancament de sessió */}
        <div className="border-t border-[var(--rol-border-dark)] p-3 space-y-2">
          {!isCollapsed && (
            <div className="rounded-[var(--rol-radius-md)] bg-[var(--rol-bg-sidebar-hover)]/70 px-3 py-2">
              <p className="truncate text-sm font-medium text-[var(--rol-ink-on-dark)]">
                {actor.displayName}
              </p>
              <p className="truncate text-xs text-[var(--rol-accent-gold-soft)]">
                {actor.roleLabel}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={isCollapsed ? 'Tancar sessió' : undefined}
            className={`flex w-full items-center gap-3 rounded-[var(--rol-radius-md)] px-3 py-2 text-sm text-[var(--rol-ink-on-dark-muted)] hover:bg-[var(--rol-bg-sidebar-hover)] hover:text-[var(--rol-ink-on-dark)] cursor-pointer disabled:opacity-50 ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>{loggingOut ? 'Sortint…' : 'Tancar sessió'}</span>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Menú lateral plegable en escriptori i tauleta */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Calaix lateral en mòbil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw]">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Contingut principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior mòbil */}
        <header className="flex items-center justify-between border-b border-[var(--rol-border-subtle)] bg-[var(--rol-bg-surface)] px-4 py-3 md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Obrir el menú"
              className="rounded-md border border-[var(--rol-border-subtle)] p-2 text-[var(--rol-ink-primary)] hover:bg-[var(--rol-bg-surface-alt)] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="rol-heading-flourish text-lg font-bold text-[var(--rol-ink-primary)]">
              Rol
            </span>
          </div>
          <Badge tone="gold">{actor.roleLabel}</Badge>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {(pageTitle || pageSubtitle || headerActions) && (
            <div className="mb-6 flex flex-col gap-3 border-b border-[var(--rol-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {pageTitle && (
                  <h1 className="rol-heading-flourish text-2xl font-bold sm:text-3xl">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="mt-1 text-sm text-[var(--rol-ink-secondary)]">{pageSubtitle}</p>
                )}
              </div>
              {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
