import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsDownUp,
  CheckCircle,
  Clock,
  DownloadSimple,
  MagnifyingGlass,
  Trash,
  UserFocus,
  WifiHigh,
  WifiSlash,
  X,
} from '@phosphor-icons/react';
import { CandidateAnswerRecord, ExamSubmissionReceipt, TelemetryEvent } from '../types/exam';
import { generateSafeCsv } from '../lib/security-utils';
import { soundEngine } from '../lib/sound-engine';

interface MonitoredCandidate {
  session_id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  class_name: string;
  exam_version: number;
  mode: string;
  status: 'in_progress' | 'submitted' | 'expired';
  connection_state: 'online' | 'offline' | 'idle';
  started_at_server: number;
  last_sync_at_server: number;
  remaining_seconds: number;
  answered_count: number;
  total_questions: number;
  observable_focus_events: number;
  score: number | null;
  max_score: number;
  percentage: number | null;
  answers: Record<string, CandidateAnswerRecord>;
  telemetry: TelemetryEvent[];
  submission_receipt: ExamSubmissionReceipt | null;
}

interface ItemAnalytic {
  question_id: string;
  question_number: number;
  question_type: string;
  points: number;
  correct_rate_percent: number;
  partial_rate_percent: number;
}

interface AuditEntry {
  audit_id: string;
  timestamp: number;
  actor_role: string;
  actor_id: string;
  action: string;
  target_id: string;
  detail: string;
}

const TEACHER_TOKEN = 'teacher-authorized-session-2026';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: 'Một lựa chọn',
  true_false_cluster: 'Đúng / Sai',
  short_answer: 'Trả lời ngắn',
  multi_select: 'Nhiều lựa chọn',
};

export const TeacherMonitoringDashboard: React.FC = () => {
  const [candidates, setCandidates] = useState<MonitoredCandidate[]>([]);
  const [itemAnalytics, setItemAnalytics] = useState<ItemAnalytic[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [summary, setSummary] = useState({
    total_candidates: 0,
    in_progress_count: 0,
    submitted_count: 0,
    offline_count: 0,
    mean_score: 0,
    median_score: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionHealthy, setConnectionHealthy] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'in_progress' | 'submitted' | 'offline' | 'focus_events'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'score' | 'events'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor/dashboard', {
        headers: {
          'X-Role': 'teacher',
          'X-Teacher-Auth': TEACHER_TOKEN,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setItemAnalytics(data.item_analytics || []);
        setAuditLogs(data.audit_logs || []);
        setSummary(data.summary);
        setConnectionHealthy(true);
        setIsLoading(false);
        return;
      }
    } catch {
      setConnectionHealthy(false);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboardData();
    const timer = setInterval(() => {
      void fetchDashboardData();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = candidates.filter((c) => {
      if (statusFilter === 'in_progress' && c.status !== 'in_progress') return false;
      if (statusFilter === 'submitted' && c.status !== 'submitted') return false;
      if (statusFilter === 'offline' && c.connection_state !== 'offline') return false;
      if (statusFilter === 'focus_events' && c.observable_focus_events === 0) return false;

      if (q) {
        const hay = `${c.student_name} ${c.student_id} ${c.student_code} ${c.class_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.student_name.localeCompare(b.student_name, 'vi');
      } else if (sortBy === 'progress') {
        cmp = a.answered_count - b.answered_count;
      } else if (sortBy === 'score') {
        cmp = (a.score ?? -1) - (b.score ?? -1);
      } else if (sortBy === 'events') {
        cmp = a.observable_focus_events - b.observable_focus_events;
      }
      return sortAsc ? cmp : -cmp;
    });

    return filtered;
  }, [candidates, statusFilter, searchQuery, sortBy, sortAsc]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.session_id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  const globalActivityTimeline = useMemo(() => {
    const items: Array<TelemetryEvent & { student_name: string; student_code: string }> = [];
    for (const c of candidates) {
      for (const ev of c.telemetry) {
        items.push({
          ...ev,
          student_name: c.student_name,
          student_code: c.student_code,
        });
      }
    }
    return items.sort((a, b) => b.client_timestamp - a.client_timestamp).slice(0, 7);
  }, [candidates]);

  const handleSortColumn = (col: 'name' | 'progress' | 'score' | 'events') => {
    soundEngine.play('button_interaction');
    if (sortBy === col) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(col);
      setSortAsc(col === 'name');
    }
  };

  const handleExportCsv = async () => {
    soundEngine.play('button_interaction');
    try {
      const res = await fetch('/api/monitor/export.csv', {
        headers: {
          'X-Role': 'teacher',
          'X-Teacher-Auth': TEACHER_TOKEN,
        },
      });
      if (res.ok) {
        const csvText = await res.text();
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `khaothi-monitoring-export-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fallback client-side safe CSV export
    }

    const headers = [
      'Session ID',
      'Student Code',
      'Full Name',
      'Class',
      'Status',
      'Connection',
      'Answered',
      'Score',
      'Observable Events',
    ];
    const rows = filteredCandidates.map((c) => [
      c.session_id,
      c.student_code,
      c.student_name,
      c.class_name,
      c.status,
      c.connection_state,
      `${c.answered_count}/${c.total_questions}`,
      c.score !== null ? c.score : 'In Progress',
      c.observable_focus_events,
    ]);
    const safeCsv = generateSafeCsv(headers, rows);
    const blob = new Blob([safeCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `khaothi-monitoring-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearSessions = async () => {
    soundEngine.play('button_interaction');
    try {
      const res = await fetch('/api/monitor/clear', {
        method: 'POST',
        headers: {
          'X-Role': 'teacher',
          'X-Teacher-Auth': TEACHER_TOKEN,
        },
      });
      if (res.ok) {
        setSelectedCandidateId(null);
        await fetchDashboardData();
      }
    } catch {
      setCandidates([]);
      setItemAnalytics([]);
      setAuditLogs([]);
      setSummary({
        total_candidates: 0,
        in_progress_count: 0,
        submitted_count: 0,
        offline_count: 0,
        mean_score: 0,
        median_score: 0,
      });
    }
  };

  return (
    <div
      className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-5"
      data-testid="teacher-monitor-view"
    >
      {/* Unified Apple Command Header & 4-Column Metric Strip */}
      <header className="surface-panel mb-5 overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm sm:text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              Giám sát phòng thi
            </h1>
            <span
              data-testid="realtime-connection-status"
              className={`h-6 px-2.5 rounded-full text-[11px] font-medium border inline-flex items-center gap-1.5 ${
                connectionHealthy
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                  : 'bg-[var(--status-offline-bg)] text-[var(--status-offline-text)] border-[var(--status-offline-border)]'
              }`}
            >
              {connectionHealthy ? <WifiHigh size={12} /> : <WifiSlash size={12} />}
              <span>{connectionHealthy ? 'Trực tuyến' : 'Kết nối lại'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {candidates.length > 0 && (
              <button
                type="button"
                data-testid="clear-monitor-sessions-btn"
                onClick={() => void handleClearSessions()}
                className="interactive-control h-8 px-3 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:text-[var(--status-error-text)] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Xóa dữ liệu phiên"
              >
                <Trash size={13} />
                <span>Xóa phiên</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.play('button_interaction');
                void fetchDashboardData();
              }}
              aria-label="Làm mới dữ liệu"
              className="interactive-control h-8 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center justify-center cursor-pointer"
              title="Làm mới"
            >
              <ArrowsClockwise size={14} />
            </button>
            <button
              type="button"
              data-testid="export-csv-btn"
              onClick={() => void handleExportCsv()}
              className="interactive-control h-8 px-3.5 rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>

        {/* 4-Column Apple Metric Strip */}
        <div
          aria-label="Thống kê vận hành phòng thi"
          className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]"
        >
          <div className="px-5 py-3.5 flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-muted)]">Đang dự thi</span>
            <span className="font-mono-tabular text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {summary.in_progress_count}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                /{summary.total_candidates}
              </span>
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-muted)]">Đã nộp bài</span>
            <span className="font-mono-tabular text-xl font-semibold tracking-tight text-[var(--status-success-text)]">
              {summary.submitted_count}
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-muted)]">Gián đoạn mạng</span>
            <span className="font-mono-tabular text-xl font-semibold tracking-tight text-[var(--status-warning-text)]">
              {summary.offline_count}
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-baseline justify-between">
            <span className="text-xs text-[var(--text-muted)]">Điểm trung bình</span>
            <span className="font-mono-tabular text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {summary.mean_score}
            </span>
          </div>
        </div>
      </header>

      {/* Main 2-Column Layout: Left Candidate Grid (8 cols) + Right Unified Analytics Panel (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8 Cols: Candidate Table Surface */}
        <section
          className="lg:col-span-8 surface-panel overflow-hidden"
          aria-label="Danh sách thí sinh"
        >
          {/* Clean Apple Search & Segmented Filter Toolbar */}
          <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Pill */}
            <div className="relative w-full sm:w-56">
              <label htmlFor="candidate-search" className="sr-only">
                Tìm thí sinh
              </label>
              <MagnifyingGlass
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                id="candidate-search"
                data-testid="candidate-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm thí sinh, mã số..."
                className="w-full h-8 pl-8 pr-3 rounded-full bg-[var(--bg-subtle)]/70 border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] transition-colors focus:bg-[var(--bg-surface)]"
              />
            </div>

            {/* Segmented Filter Capsules */}
            <div
              className="inline-flex flex-wrap items-center p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
              role="group"
              aria-label="Lọc theo trạng thái"
            >
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'in_progress', label: 'Đang thi' },
                  { id: 'submitted', label: 'Đã nộp' },
                  { id: 'offline', label: 'Ngoại tuyến' },
                  { id: 'focus_events', label: 'Chuyển tab' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`filter-${f.id}`}
                  onClick={() => {
                    soundEngine.play('button_interaction');
                    setStatusFilter(f.id);
                  }}
                  className={`interactive-control h-7 px-3 rounded-full text-xs cursor-pointer whitespace-nowrap ${
                    statusFilter === f.id
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Candidate Table */}
          {isLoading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-12 rounded-[var(--radius-sm)] skeleton-shimmer" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div
              data-testid="empty-candidates-state"
              className="p-12 text-center flex flex-col items-center justify-center"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mb-3">
                <UserFocus size={18} />
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">
                Chưa có thí sinh tham gia
              </div>
              <div className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                Khi thí sinh nhập họ tên và bắt đầu làm bài tại mục Làm bài, tiến độ và điểm số sẽ hiển thị trực tiếp tại đây.
              </div>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--text-muted)]">
              Không tìm thấy thí sinh phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 text-[var(--text-muted)]">
                    <th className="py-2.5 px-4 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortColumn('name')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)]"
                      >
                        <span>Thí sinh</span>
                        <ArrowsDownUp size={11} />
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Trạng thái</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortColumn('progress')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)]"
                      >
                        <span>Tiến độ</span>
                        <ArrowsDownUp size={11} />
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortColumn('events')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)]"
                      >
                        <span>Sự kiện</span>
                        <ArrowsDownUp size={11} />
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSortColumn('score')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)]"
                      >
                        <span>Điểm</span>
                        <ArrowsDownUp size={11} />
                      </button>
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap">Hồ sơ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredCandidates.map((cand, idx) => (
                    <tr
                      key={cand.session_id}
                      data-testid={`candidate-row-${cand.student_id}`}
                      style={{ '--stagger-index': idx } as React.CSSProperties}
                      className="apple-stagger-item hover:bg-[var(--bg-subtle)]/35 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[var(--text-primary)] text-[13px]">
                          {cand.student_name}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                          {cand.student_code} · {cand.class_name}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {cand.connection_state === 'offline' ? (
                          <span className="h-6 px-2.5 rounded-full text-[11px] font-medium bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)] inline-flex items-center gap-1">
                            <WifiSlash size={11} />
                            <span>Ngoại tuyến</span>
                          </span>
                        ) : cand.status === 'submitted' ? (
                          <span className="h-6 px-2.5 rounded-full text-[11px] font-medium bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)] inline-flex items-center gap-1">
                            <CheckCircle size={11} weight="fill" />
                            <span>Đã nộp</span>
                          </span>
                        ) : (
                          <span className="h-6 px-2.5 rounded-full text-[11px] font-medium bg-[var(--bg-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1">
                            <Clock size={11} />
                            <span>Đang thi</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {cand.answered_count}/{cand.total_questions}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                        <span
                          className={`h-6 px-2 rounded-full text-[11px] font-medium inline-flex items-center ${
                            cand.observable_focus_events > 0
                              ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {cand.observable_focus_events}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                        {cand.score !== null ? (
                          <span className="font-semibold text-[13px] text-[var(--text-primary)]">
                            {cand.score} / {cand.max_score}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          data-testid={`inspect-cand-${cand.student_id}`}
                          onClick={() => {
                            soundEngine.play('button_interaction');
                            setSelectedCandidateId(cand.session_id);
                          }}
                          className="interactive-control h-7 px-3 rounded-full bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center cursor-pointer whitespace-nowrap"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right 4 Cols: Unified Analytics Matrix & Chronological Stream */}
        <aside className="lg:col-span-4 surface-panel overflow-hidden divide-y divide-[var(--border-subtle)]">
          {/* Item Accuracy Matrix */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                Tỷ lệ đúng theo câu
              </h2>
              <span className="text-[11px] text-[var(--text-muted)]">Chính xác</span>
            </div>

            {itemAnalytics.length === 0 ? (
              <div className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/20 text-center text-xs text-[var(--text-muted)]">
                Chưa có dữ liệu thống kê câu hỏi.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden">
                {itemAnalytics.map((item) => (
                  <div
                    key={item.question_id}
                    className="px-3.5 py-2.5 bg-[var(--bg-surface)] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                        Câu {String(item.question_number).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {QUESTION_TYPE_LABELS[item.question_type] || item.question_type}
                      </span>
                    </div>
                    <div className="font-mono-tabular flex items-center gap-1.5">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {item.correct_rate_percent}%
                      </span>
                      {item.partial_rate_percent > 0 && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          (+{item.partial_rate_percent}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Observable Telemetry Stream */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                Nhật ký sự kiện
              </h2>
              <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                {auditLogs.length}
              </span>
            </div>

            {globalActivityTimeline.length === 0 ? (
              <div className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/20 text-center text-xs text-[var(--text-muted)]">
                Chưa có sự kiện nào được ghi nhận.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden max-h-68 overflow-y-auto">
                {globalActivityTimeline.map((ev) => (
                  <div key={ev.event_id} className="px-3.5 py-2.5 bg-[var(--bg-surface)] text-xs">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {ev.student_name}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[var(--text-muted)] shrink-0">
                        {new Date(ev.client_timestamp).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {ev.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Apple Slide-Over Candidate Detail Inspector */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex justify-end bg-[var(--bg-overlay)] backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-detail-title"
          data-testid="candidate-detail-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCandidateId(null);
          }}
        >
          <div className="apple-sheet-slide w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-[var(--shadow-lg)] h-full overflow-y-auto p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] text-[var(--text-primary)] flex items-center justify-center">
                    <UserFocus size={17} />
                  </div>
                  <div>
                    <h2
                      id="candidate-detail-title"
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      {selectedCandidate.student_name}
                    </h2>
                    <p className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {selectedCandidate.student_code} · {selectedCandidate.class_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="close-candidate-detail-btn"
                  onClick={() => setSelectedCandidateId(null)}
                  className="interactive-control h-8 w-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
                  aria-label="Đóng bảng chi tiết"
                >
                  <X size={15} weight="bold" />
                </button>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 mb-5 text-center">
                <div className="p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Tiến độ</div>
                  <div className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                    {selectedCandidate.answered_count}/{selectedCandidate.total_questions}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Điểm số</div>
                  <div className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                    {selectedCandidate.score !== null
                      ? `${selectedCandidate.score}/${selectedCandidate.max_score}`
                      : 'Đang thi'}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] text-[var(--text-muted)]">Sự kiện</div>
                  <div className="font-mono-tabular text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                    {selectedCandidate.observable_focus_events}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2.5">
                  Trạng thái câu trả lời ({Object.keys(selectedCandidate.answers).length}/{selectedCandidate.total_questions})
                </h3>
                {Object.keys(selectedCandidate.answers).length === 0 ? (
                  <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 text-xs text-[var(--text-muted)] text-center">
                    Thí sinh chưa chọn đáp án nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(selectedCandidate.answers).map(([qId, ans], idx) => (
                      <div
                        key={qId}
                        className="p-2.5 rounded-[var(--radius-sm)] border text-xs font-mono-tabular flex items-center justify-between bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]"
                      >
                        <span className="font-semibold">Câu {idx + 1}</span>
                        <span className="text-[10px]">#{ans.sequence_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2.5">
                  Nhật ký phiên ({selectedCandidate.telemetry.length})
                </h3>
                <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] overflow-hidden">
                  {selectedCandidate.telemetry.map((ev) => (
                    <div key={ev.event_id} className="p-3 bg-[var(--bg-surface)] text-xs">
                      <div className="flex items-center justify-between font-mono-tabular text-[11px] text-[var(--text-muted)] mb-0.5">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {ev.event_type}
                        </span>
                        <span>{new Date(ev.client_timestamp).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      <div className="text-[var(--text-secondary)]">{ev.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] font-mono-tabular">
              {selectedCandidate.session_id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
