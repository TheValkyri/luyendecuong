import React, { useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  Books,
  ChartLineUp,
  Lightning,
  Moon,
  Palette,
  ShieldCheck,
  SpeakerHigh,
  SpeakerSlash,
  Sun,
  X,
} from '@phosphor-icons/react';
import { StudentWorkspace } from './components/StudentWorkspace';
import { TeacherMonitoringDashboard } from './components/TeacherMonitoringDashboard';
import { TeacherQuestionStudio } from './components/TeacherQuestionStudio';
import {
  DESIGN_SYSTEM_TOKENS,
  getStateTokenClasses,
  SUPPORTED_COMPONENT_STATES,
} from './lib/design-tokens';
import { motionEngine } from './lib/motion-engine';
import { soundEngine } from './lib/sound-engine';

export type AdminWorkspaceView = 'teacher_studio' | 'teacher_monitor';

const ADMIN_TABS: Array<{
  id: AdminWorkspaceView;
  testId: string;
  label: string;
  Icon: typeof Books;
}> = [
  { id: 'teacher_studio', testId: 'nav-tab-studio', label: 'Biên soạn', Icon: Books },
  { id: 'teacher_monitor', testId: 'nav-tab-monitor', label: 'Giám sát', Icon: ChartLineUp },
];

function detectIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    hash.includes('admin') ||
    hash.includes('studio') ||
    hash.includes('monitor') ||
    params.has('admin') ||
    viewParam === 'teacher_studio' ||
    viewParam === 'teacher_monitor'
  );
}

function detectInitialAdminTab(): AdminWorkspaceView {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    if (
      pathname.includes('/monitor') ||
      hash.includes('monitor') ||
      params.get('view') === 'teacher_monitor'
    ) {
      return 'teacher_monitor';
    }
  }
  return 'teacher_studio';
}

export const App: React.FC = () => {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(detectIsAdminRoute);
  const [adminTab, setAdminTab] = useState<AdminWorkspaceView>(detectInitialAdminTab);

  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    motionEngine.isReducedMotionPreferred()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    soundEngine.getSettings().enabled
  );
  const [soundVolume, setSoundVolume] = useState<number>(() =>
    soundEngine.getSettings().volume
  );
  const [showDesignTokensModal, setShowDesignTokensModal] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminRoute(detectIsAdminRoute());
      setAdminTab(detectInitialAdminTab());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const navigateToStudentPortal = () => {
    soundEngine.play('navigation');
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
  };

  const handleSelectAdminTab = (tab: AdminWorkspaceView) => {
    if (adminTab !== tab) {
      soundEngine.play('navigation');
      setAdminTab(tab);
      const nextUrl = tab === 'teacher_monitor' ? '/admin/monitor' : '/admin';
      window.history.pushState({}, '', nextUrl);
    }
  };

  const activeAdminTabIndex = Math.max(
    0,
    ADMIN_TABS.findIndex((t) => t.id === adminTab)
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-x-hidden w-full max-w-full">
      {/* Skip to Main Content Link (WCAG 2.2 AA) */}
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-toast)] focus:px-3.5 focus:py-2 focus:rounded-full focus:bg-[var(--accent-primary)] focus:text-white focus:text-xs focus:font-semibold"
      >
        Chuyển đến nội dung chính
      </a>

      {/* =====================================================================
          STUDENT PORTAL NAVIGATION BAR (Zero Admin Controls Exposed)
         ===================================================================== */}
      {!isAdminRoute && !focusMode && (
        <nav
          aria-label="Thanh công cụ Cổng Khảo thí Học sinh"
          data-testid="student-top-navbar"
          className="sticky top-0 z-[var(--z-sticky)] apple-glass-bar"
        >
          <div className="w-full max-w-[1160px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-3">
            {/* Academic Brand Identity */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded-[8px] bg-[var(--text-primary)] text-[var(--text-inverse)] flex items-center justify-center font-mono-tabular font-bold text-xs tracking-tight shadow-xs">
                KT
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  KhaoThi
                </span>
                <span className="hidden sm:inline text-[var(--border-strong)]">·</span>
                <span className="hidden sm:inline text-xs font-medium text-[var(--text-muted)]">
                  Hệ thống Khảo thí & Đánh giá Năng lực
                </span>
              </div>
            </div>

            {/* Center Academic Verification Badge */}
            <div className="hidden md:inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[var(--bg-subtle)]/90 border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success-solid)]" />
              <span>Cổng làm bài trực tuyến</span>
            </div>

            {/* Minimal Student Comfort Controls (Sound & Theme Only — No Admin Settings) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-8 px-2.5 rounded-full bg-[var(--bg-subtle)]/80 border border-[var(--border-subtle)] flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="sound-toggle-btn"
                  onClick={() => {
                    const next = !soundEnabled;
                    soundEngine.setEnabled(next);
                    setSoundEnabled(next);
                    if (next) soundEngine.play('button_interaction');
                  }}
                  aria-pressed={soundEnabled}
                  aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                  className="interactive-control text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center"
                >
                  {soundEnabled ? (
                    <SpeakerHigh size={15} weight="fill" />
                  ) : (
                    <SpeakerSlash size={15} />
                  )}
                </button>
                <label htmlFor="sfx-volume-slider" className="sr-only">
                  Âm lượng hiệu ứng
                </label>
                <input
                  id="sfx-volume-slider"
                  data-testid="sound-volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundVolume}
                  disabled={!soundEnabled}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSoundVolume(v);
                    soundEngine.setVolume(v);
                  }}
                  className="hidden sm:block w-12 accent-[var(--accent-primary)] cursor-pointer"
                />
              </div>

              <button
                type="button"
                data-testid="theme-toggle-btn"
                onClick={() => {
                  soundEngine.play('button_interaction');
                  setTheme((t) => (t === 'light' ? 'dark' : 'light'));
                }}
                aria-label={
                  theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'
                }
                className="interactive-control h-8 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                title={theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
              >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* =====================================================================
          ADMIN PORTAL NAVIGATION BAR (/admin — Studio, Monitor & System Config)
         ===================================================================== */}
      {isAdminRoute && (
        <nav
          aria-label="Điều hướng Quản trị Hệ thống Khảo thí"
          data-testid="admin-top-navbar"
          className="sticky top-0 z-[var(--z-sticky)] apple-glass-bar"
        >
          <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-2">
            {/* Admin Brand Mark */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-[8px] bg-[var(--text-primary)] text-[var(--text-inverse)] flex items-center justify-center font-mono-tabular font-bold text-xs tracking-tight shadow-xs">
                KT
              </div>
              <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)] hidden sm:inline">
                KhaoThi
              </span>
              <span className="hidden md:inline-flex h-5 px-2 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-border)] text-[10px] font-semibold tracking-wide uppercase items-center gap-1">
                <ShieldCheck size={12} weight="fill" />
                <span>Admin</span>
              </span>
            </div>

            {/* Admin Segmented Control: Biên soạn & Tải đề | Giám sát & Thống kê */}
            <div
              className="relative inline-grid grid-cols-2 items-center p-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
              role="tablist"
              aria-label="Chọn phân hệ quản trị"
            >
              <div
                aria-hidden="true"
                className="apple-segmented-pill pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/2)] rounded-full bg-[var(--bg-surface)]"
                style={{
                  transform: `translate3d(${activeAdminTabIndex * 100}%, 0, 0)`,
                }}
              />

              {ADMIN_TABS.map(({ id, testId, label, Icon }) => {
                const isActive = adminTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    data-testid={testId}
                    aria-selected={isActive}
                    onClick={() => handleSelectAdminTab(id)}
                    className={`relative z-10 h-7 px-3 sm:px-4 rounded-full text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-[var(--text-primary)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                    }`}
                  >
                    <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Admin Utility Cluster + Quick Link to Student Portal */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="nav-tab-student"
                onClick={navigateToStudentPortal}
                className="interactive-control h-8 px-3 rounded-full bg-[var(--bg-subtle)]/90 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                title="Chuyển sang giao diện Cổng Học sinh (/)"
              >
                <span className="hidden md:inline">Cổng Học sinh</span>
                <ArrowSquareOut size={14} />
              </button>

              {/* Sound On/Off + Compact Volume */}
              <div className="h-8 px-2.5 rounded-full bg-[var(--bg-subtle)]/80 border border-[var(--border-subtle)] flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="sound-toggle-btn"
                  onClick={() => {
                    const next = !soundEnabled;
                    soundEngine.setEnabled(next);
                    setSoundEnabled(next);
                    if (next) soundEngine.play('button_interaction');
                  }}
                  aria-pressed={soundEnabled}
                  aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                  className="interactive-control text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center"
                >
                  {soundEnabled ? (
                    <SpeakerHigh size={15} weight="fill" />
                  ) : (
                    <SpeakerSlash size={15} />
                  )}
                </button>
                <label htmlFor="sfx-volume-slider-admin" className="sr-only">
                  Âm lượng hiệu ứng
                </label>
                <input
                  id="sfx-volume-slider-admin"
                  data-testid="sound-volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundVolume}
                  disabled={!soundEnabled}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSoundVolume(v);
                    soundEngine.setVolume(v);
                  }}
                  className="hidden lg:block w-12 accent-[var(--accent-primary)] cursor-pointer"
                />
              </div>

              {/* Reduced Motion Toggle */}
              <button
                type="button"
                data-testid="reduced-motion-btn"
                aria-pressed={reducedMotion}
                aria-label={reducedMotion ? 'Bật hiệu ứng chuyển động' : 'Giảm hiệu ứng chuyển động'}
                onClick={() => {
                  const next = !reducedMotion;
                  setReducedMotion(next);
                  motionEngine.setReducedMotionOverride(next);
                }}
                className={`interactive-control h-8 w-8 rounded-full border flex items-center justify-center cursor-pointer ${
                  reducedMotion
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                    : 'bg-[var(--bg-subtle)]/80 text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
                title={reducedMotion ? 'Đang giảm chuyển động' : 'Chuyển động tiêu chuẩn'}
              >
                <Lightning size={15} weight={reducedMotion ? 'fill' : 'regular'} />
              </button>

              {/* Design System Tokens Inspector (Admin Only) */}
              <button
                type="button"
                data-testid="design-tokens-btn"
                aria-label="Hệ thống Design Tokens"
                onClick={() => {
                  soundEngine.play('button_interaction');
                  setShowDesignTokensModal(true);
                }}
                className="interactive-control h-8 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                title="Hệ thống Design Tokens"
              >
                <Palette size={15} />
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                data-testid="theme-toggle-btn"
                onClick={() => {
                  soundEngine.play('button_interaction');
                  setTheme((t) => (t === 'light' ? 'dark' : 'light'));
                }}
                aria-label={
                  theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'
                }
                className="interactive-control h-8 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                title={theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
              >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Active Workspace Container */}
      <div
        id="workspace-main"
        key={isAdminRoute ? `admin_${adminTab}` : 'student_portal'}
        className="flex-1 flex flex-col apple-view-enter"
      >
        {!isAdminRoute ? (
          <StudentWorkspace
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((f) => !f)}
          />
        ) : adminTab === 'teacher_monitor' ? (
          <TeacherMonitoringDashboard />
        ) : (
          <TeacherQuestionStudio />
        )}
      </div>

      {/* Design System & 11 Component States Inspector Modal (Admin Only) */}
      {isAdminRoute && showDesignTokensModal && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-[var(--bg-overlay)] backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="design-tokens-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDesignTokensModal(false);
          }}
        >
          <div className="modal-transition w-full max-w-xl rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-[var(--shadow-lg)] p-6 max-h-[88dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border-subtle)]">
              <div>
                <h2
                  id="design-tokens-title"
                  className="text-base font-semibold text-[var(--text-primary)]"
                >
                  Design Tokens & Motion Engine
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Apple Human Interface Precision · {DESIGN_SYSTEM_TOKENS.meta.wcagTarget}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDesignTokensModal(false)}
                className="interactive-control h-8 w-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center cursor-pointer text-[var(--text-secondary)]"
                aria-label="Đóng"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <div className="mb-6">
              <div className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
                11 Trạng thái chuẩn hóa
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUPPORTED_COMPONENT_STATES.map((st) => (
                  <div
                    key={st}
                    className={`h-9 px-3 rounded-[var(--radius-sm)] border text-xs font-mono-tabular flex items-center justify-between ${getStateTokenClasses(
                      st
                    )}`}
                  >
                    <span className="font-semibold capitalize">{st}</span>
                    <span className="text-[10px] opacity-60">AA</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
                Thông số chuyển động (Spring Choreography)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-tabular">
                <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/60">
                  <div className="text-[var(--text-muted)]">Vi tương tác</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {DESIGN_SYSTEM_TOKENS.motion.durationsMs.microInteraction}ms
                  </div>
                </div>
                <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/60">
                  <div className="text-[var(--text-muted)]">Chuyển cảnh</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {DESIGN_SYSTEM_TOKENS.motion.durationsMs.componentTransition}ms
                  </div>
                </div>
                <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/60">
                  <div className="text-[var(--text-muted)]">Hộp thoại</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {DESIGN_SYSTEM_TOKENS.motion.durationsMs.modalTransition}ms
                  </div>
                </div>
                <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)]/60">
                  <div className="text-[var(--text-muted)]">Hoàn tất</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {DESIGN_SYSTEM_TOKENS.motion.durationsMs.completionAnimation}ms
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
