/**
 * TELEMETRY & LIVE TRACKING ENGINE FOR LUYENDECUONG
 * Supports:
 * 1. BroadcastChannel (0ms real-time sync across tabs/windows on same device)
 * 2. LocalStorage Events (fallback local sync)
 * 3. Firebase Realtime Database REST API (Zero-SDK cloud sync across all student phones and computers globally)
 */

(function(window) {
  const DEFAULT_CLOUD_URL = "https://thptvttn-default-rtdb.asia-southeast1.firebasedatabase.app";
  const CLOUD_URL_KEY = "luyendecuong_cloud_url";
  const LIVE_SESSIONS_LOCAL_KEY = "luyendecuong_live_sessions";
  const BC_CHANNEL_NAME = "luyendecuong_telemetry_bc";

  let bc = null;
  try {
    if (typeof window.BroadcastChannel === "function") {
      bc = new BroadcastChannel(BC_CHANNEL_NAME);
    }
  } catch(e) {
    bc = null;
  }

  let currentSessionId = sessionStorage.getItem("luyendecuong_sess_id") || null;
  let heartbeatTimer = null;

  function getCloudUrl() {
    let url = localStorage.getItem(CLOUD_URL_KEY) || DEFAULT_CLOUD_URL || window.LUYENDECUONG_DEFAULT_CLOUD_URL || "";
    if (url && url.endsWith("/")) url = url.slice(0, -1);
    return url;
  }

  function setCloudUrl(url) {
    if (url) {
      url = url.trim();
      if (url.endsWith("/")) url = url.slice(0, -1);
      localStorage.setItem(CLOUD_URL_KEY, url);
    } else {
      localStorage.removeItem(CLOUD_URL_KEY);
    }
  }

  function detectDevice() {
    const ua = navigator.userAgent || "";
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    let os = "Desktop";
    if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/Edg/i.test(ua)) browser = "Edge";
    else if (/Chrome/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua)) browser = "Safari";
    else if (/Firefox/i.test(ua)) browser = "Firefox";

    return {
      isMobile,
      os,
      browser,
      tag: (isMobile ? "📱 " : "💻 ") + os + " · " + browser
    };
  }

  // Calculate live provisional score for any set of questions and user answers
  function calculateProvisionalScore(questions, userAnswers) {
    if (!questions || !questions.length) return { score: 0, grade10: 0, answered: 0, total: 0, correct: 0, wrong: 0 };
    
    let totalQuestions = questions.length;
    let answeredCount = 0;
    let earnedWeight = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach(q => {
      const uAns = userAnswers[q.id];
      if (q.type === "true_false" || q.items) {
        if (uAns && typeof uAns === "object" && Object.keys(uAns).length > 0) {
          answeredCount++;
          let subCor = 0;
          (q.items || []).forEach(it => {
            if (uAns[it.id] === it.correct) subCor++;
          });
          let tfPoint = 0;
          if (subCor === 4) tfPoint = 1.0;
          else if (subCor === 3) tfPoint = 0.5;
          else if (subCor === 2) tfPoint = 0.25;
          else if (subCor === 1) tfPoint = 0.1;

          earnedWeight += tfPoint;
          if (tfPoint >= 0.5) correctCount++;
          else wrongCount++;
        }
      } else if (q.model_answer) {
        if (uAns && typeof uAns === "string" && uAns.trim().length > 0) {
          answeredCount++;
          // Basic heuristic / auto-grade if helper exists
          let writingScore = 0;
          if (typeof window.gradeWritingAnswer === "function") {
            const res = window.gradeWritingAnswer(uAns, q);
            writingScore = res.score;
          } else {
            writingScore = (uAns.trim().toLowerCase() === q.model_answer.trim().toLowerCase()) ? 1.0 : 0.5;
          }
          earnedWeight += writingScore;
          if (writingScore >= 0.5) correctCount++;
          else wrongCount++;
        }
      } else {
        if (uAns !== undefined && uAns !== null && uAns !== "") {
          answeredCount++;
          if (uAns === q.answer) {
            earnedWeight += 1;
            correctCount++;
          } else {
            wrongCount++;
          }
        }
      }
    });

    const grade10 = totalQuestions > 0 ? Math.round((earnedWeight / totalQuestions) * 10 * 10) / 10 : 0;
    return {
      earnedWeight: Math.round(earnedWeight * 10) / 10,
      grade10,
      answered: answeredCount,
      total: totalQuestions,
      correct: correctCount,
      wrong: wrongCount,
      progressPct: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
    };
  }

  // Save live session state locally
  function saveLocalActiveSession(sessionData) {
    try {
      let sessions = JSON.parse(localStorage.getItem(LIVE_SESSIONS_LOCAL_KEY) || "{}");
      sessions[sessionData.sessionId] = sessionData;
      // Clean up sessions older than 30 minutes
      const now = Date.now();
      Object.keys(sessions).forEach(k => {
        if (now - (sessions[k].lastActive || 0) > 30 * 60 * 1000) {
          delete sessions[k];
        }
      });
      localStorage.setItem(LIVE_SESSIONS_LOCAL_KEY, JSON.stringify(sessions));
    } catch(e) {}
  }

  function removeLocalActiveSession(sessionId) {
    try {
      let sessions = JSON.parse(localStorage.getItem(LIVE_SESSIONS_LOCAL_KEY) || "{}");
      delete sessions[sessionId];
      localStorage.setItem(LIVE_SESSIONS_LOCAL_KEY, JSON.stringify(sessions));
    } catch(e) {}
  }

  // Post to Cloud (Firebase Realtime Database REST API)
  async function pushToCloud(endpoint, method, data) {
    const cloudUrl = getCloudUrl();
    if (!cloudUrl) return null;
    try {
      const resp = await fetch(`${cloudUrl}/${endpoint}.json`, {
        method: method || "PUT",
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : null
      });
      return await resp.json();
    } catch(err) {
      console.warn("[Telemetry] Cloud push failed:", err);
      return null;
    }
  }

  // --- PUBLIC API ---
  const Telemetry = {
    getCloudUrl,
    setCloudUrl,
    detectDevice,
    calculateProvisionalScore,

    getSessionId() {
      if (!currentSessionId) {
        currentSessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem("luyendecuong_sess_id", currentSessionId);
      }
      return currentSessionId;
    },

    startSession(meta) {
      const sessionId = Telemetry.getSessionId();
      const sessionData = {
        sessionId,
        studentName: meta.studentName,
        subject: meta.subject || "english",
        subjectName: meta.subjectName || "Tiếng Anh 11",
        practiceMode: meta.practiceMode || "full",
        totalCount: meta.totalCount || 0,
        answeredCount: 0,
        provisionalScore: 0,
        provisionalGrade10: 0,
        correctCount: 0,
        wrongCount: 0,
        progressPct: 0,
        startTime: Date.now(),
        lastActive: Date.now(),
        elapsedSeconds: 0,
        device: detectDevice(),
        status: "active",
        userAnswers: {}
      };

      saveLocalActiveSession(sessionData);
      if (bc) bc.postMessage({ type: "SESSION_STARTED", session: sessionData });
      pushToCloud(`active_sessions/${sessionId}`, "PUT", sessionData);

      // Record student attempt history in Cloud
      if (meta.studentName) {
        const safeKey = meta.studentName.trim().replace(/[.#$\[\]\/]/g, '_');
        pushToCloud(`student_history/${safeKey}/studentName`, "PUT", meta.studentName);
        pushToCloud(`student_history/${safeKey}/lastSeen`, "PUT", Date.now());
        pushToCloud(`student_history/${safeKey}/lastSubject`, "PUT", meta.subject || "english");
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}`, "PUT", {
          sessionId,
          subject: meta.subject || "english",
          startTime: Date.now(),
          status: "in_progress",
          device: detectDevice()
        });
      }

      // Start periodic heartbeat
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        Telemetry.heartbeat();
      }, 8000);

      return sessionData;
    },

    updateProgress(updateData) {
      const sessionId = Telemetry.getSessionId();
      const sessionData = {
        sessionId,
        studentName: updateData.studentName,
        subject: updateData.subject,
        subjectName: updateData.subjectName,
        practiceMode: updateData.practiceMode,
        totalCount: updateData.totalCount,
        answeredCount: updateData.answeredCount,
        provisionalScore: updateData.provisionalScore,
        provisionalGrade10: updateData.provisionalGrade10,
        correctCount: updateData.correctCount,
        wrongCount: updateData.wrongCount,
        progressPct: updateData.progressPct,
        currentQuestionGlobalIdx: updateData.currentQuestionGlobalIdx,
        currentQuestionLabel: updateData.currentQuestionLabel,
        elapsedSeconds: updateData.elapsedSeconds,
        lastActive: Date.now(),
        device: detectDevice(),
        status: "active",
        userAnswers: updateData.userAnswers || {}
      };

      saveLocalActiveSession(sessionData);
      if (bc) bc.postMessage({ type: "PROGRESS_UPDATED", session: sessionData });
      pushToCloud(`active_sessions/${sessionId}`, "PUT", sessionData);

      if (updateData.studentName) {
        const safeKey = updateData.studentName.trim().replace(/[.#$\[\]\/]/g, '_');
        pushToCloud(`student_history/${safeKey}/lastSeen`, "PUT", Date.now());
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/lastActive`, "PUT", Date.now());
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/progress`, "PUT", `${updateData.answeredCount}/${updateData.totalCount}`);
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/provisionalGrade10`, "PUT", updateData.provisionalGrade10 || 0);
      }
    },

    heartbeat() {
      const sessionId = Telemetry.getSessionId();
      const now = Date.now();
      try {
        let sessions = JSON.parse(localStorage.getItem(LIVE_SESSIONS_LOCAL_KEY) || "{}");
        if (sessions[sessionId]) {
          sessions[sessionId].lastActive = now;
          if (window.AppState) {
            sessions[sessionId].elapsedSeconds = window.AppState.elapsedSeconds || sessions[sessionId].elapsedSeconds;
          }
          localStorage.setItem(LIVE_SESSIONS_LOCAL_KEY, JSON.stringify(sessions));
        }
      } catch(e) {}

      pushToCloud(`active_sessions/${sessionId}/lastActive`, "PUT", now);
    },

    completeSession(submissionRecord) {
      const sessionId = Telemetry.getSessionId();
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      removeLocalActiveSession(sessionId);
      if (bc) bc.postMessage({ type: "SESSION_FINISHED", sessionId, submission: submissionRecord });

      // Remove from active_sessions in cloud
      pushToCloud(`active_sessions/${sessionId}`, "DELETE");

      // Save submission record to cloud
      if (submissionRecord && submissionRecord.id) {
        pushToCloud(`submissions/${submissionRecord.id}`, "PUT", submissionRecord);
      }

      if (submissionRecord && submissionRecord.studentName) {
        const safeKey = submissionRecord.studentName.trim().replace(/[.#$\[\]\/]/g, '_');
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/status`, "PUT", "completed");
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/completedTime`, "PUT", Date.now());
        pushToCloud(`student_history/${safeKey}/attempts/${sessionId}/grade10`, "PUT", submissionRecord.grade10);
      }

      sessionStorage.removeItem("luyendecuong_sess_id");
      currentSessionId = null;
    },

    // --- DEV DASHBOARD METHODS ---
    async getActiveSessions() {
      let merged = {};

      // 1. Local telemetry sessions
      try {
        const local = JSON.parse(localStorage.getItem(LIVE_SESSIONS_LOCAL_KEY) || "{}");
        Object.assign(merged, local);
      } catch(e) {}

      // 1b. Check pre-existing active sessions in browser from before dev update!
      const legacyActiveKeys = [
        { key: "quiz_active_session_english", sub: "english", name: "Tiếng Anh 11" },
        { key: "quiz_active_session_physics", sub: "physics", name: "Vật Lí 11" },
        { key: "quiz_active_session_history", sub: "history", name: "Lịch Sử 11" },
        { key: "eng11_thpt_vinhtuan_active_session", sub: "english", name: "Tiếng Anh 11" }
      ];
      legacyActiveKeys.forEach(item => {
        try {
          const raw = localStorage.getItem(item.key);
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.studentName) {
              const sessId = "sess_" + (data.subject || item.sub) + "_" + data.studentName.replace(/\s+/g, '_');
              if (!merged[sessId]) {
                const sub = data.subject || item.sub;
                const subName = item.name;
                const uAns = data.userAnswers || {};
                const ansCount = Object.keys(uAns).length;
                const totCount = (sub === "history" ? 166 : (sub === "physics" ? 160 : 89));

                merged[sessId] = {
                  sessionId: sessId,
                  studentName: data.studentName,
                  subject: sub,
                  subjectName: subName,
                  practiceMode: data.practiceMode || "full",
                  totalCount: totCount,
                  answeredCount: ansCount,
                  provisionalScore: 0,
                  provisionalGrade10: 0,
                  correctCount: 0,
                  wrongCount: 0,
                  progressPct: Math.round((ansCount / totCount) * 100),
                  currentQuestionGlobalIdx: data.activeQuestionGlobalIdx || 0,
                  currentQuestionLabel: `Câu ${(data.activeQuestionGlobalIdx || 0) + 1}`,
                  elapsedSeconds: data.elapsedSeconds || 0,
                  lastActive: data.timestamp || Date.now(),
                  device: { isMobile: false, os: "Web", browser: "Browser", tag: "📱 Phiên làm bài trước update" },
                  status: "active",
                  userAnswers: uAns
                };
              }
            }
          }
        } catch(e) {}
      });

      // 2. Cloud sessions
      const cloudUrl = getCloudUrl();
      if (cloudUrl) {
        try {
          const resp = await fetch(`${cloudUrl}/active_sessions.json`);
          if (resp.ok) {
            const cloudData = await resp.json();
            if (cloudData && typeof cloudData === "object") {
              Object.assign(merged, cloudData);
            }
          }
        } catch(e) {
          console.warn("[Telemetry] Fetch cloud active sessions failed:", e);
        }
      }

      // 3. Deduplicate active sessions: Merge duplicate records for the same student & subject
      const dedupMap = {};
      Object.values(merged).forEach(sess => {
        if (!sess || !sess.studentName) return;
        const key = sess.studentName.trim().toLowerCase() + "___" + (sess.subject || "english");
        if (!dedupMap[key]) {
          dedupMap[key] = sess;
        } else {
          const cur = dedupMap[key];
          const sessIsLegacy = !!(sess.device && sess.device.tag && sess.device.tag.includes("trước update"));
          const curIsLegacy = !!(cur.device && cur.device.tag && cur.device.tag.includes("trước update"));

          if (curIsLegacy && !sessIsLegacy) {
            dedupMap[key] = sess;
          } else if (!curIsLegacy && sessIsLegacy) {
            // Keep cur
          } else {
            const sessNewer = (sess.lastActive || 0) >= (cur.lastActive || 0);
            if (sessNewer || (sess.answeredCount || 0) > (cur.answeredCount || 0)) {
              sess.answeredCount = Math.max(sess.answeredCount || 0, cur.answeredCount || 0);
              sess.userAnswers = Object.assign({}, cur.userAnswers, sess.userAnswers);
              sess.provisionalGrade10 = Math.max(sess.provisionalGrade10 || 0, cur.provisionalGrade10 || 0);
              dedupMap[key] = sess;
            }
          }
        }
      });

      const finalMap = {};
      Object.values(dedupMap).forEach(s => {
        finalMap[s.sessionId || s.studentName] = s;
      });
      return finalMap;
    },

    async getAllSubmissions() {
      let list = [];
      // 1. Local submissions from all primary & legacy storage keys
      try {
        const primary = JSON.parse(localStorage.getItem("quiz_student_records_v2") || "[]");
        const legacy = JSON.parse(localStorage.getItem("eng11_thpt_vinhtuan_student_records") || "[]");
        const v2 = JSON.parse(localStorage.getItem("quiz_submissions_v2") || "[]");

        const existingIds = new Set();
        [...primary, ...legacy, ...v2].forEach(r => {
          if (r && (r.id || r.timestamp)) {
            const id = r.id || ("sub_" + new Date(r.timestamp).getTime());
            if (!existingIds.has(id)) {
              existingIds.add(id);
              list.push({ ...r, id });
            }
          }
        });
      } catch(e) {}

      // 2. Cloud submissions
      const cloudUrl = getCloudUrl();
      if (cloudUrl) {
        try {
          const resp = await fetch(`${cloudUrl}/submissions.json`);
          if (resp.ok) {
            const cloudData = await resp.json();
            if (cloudData && typeof cloudData === "object") {
              const cloudList = Object.values(cloudData);
              // Merge by id
              const existingIds = new Set(list.map(r => r.id));
              cloudList.forEach(r => {
                if (r && r.id && !existingIds.has(r.id)) {
                  list.push(r);
                  existingIds.add(r.id);
                }
              });
            }
          }
        } catch(e) {
          console.warn("[Telemetry] Fetch cloud submissions failed:", e);
        }
      }

      // Sort by newest first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return list;
    },

    async clearAllDevData() {
      localStorage.removeItem(LIVE_SESSIONS_LOCAL_KEY);
      localStorage.removeItem("quiz_submissions_v2");
      localStorage.removeItem("quiz_student_records_v2");
      localStorage.removeItem("eng11_thpt_vinhtuan_student_records");
      localStorage.removeItem("quiz_active_session_english");
      localStorage.removeItem("quiz_active_session_physics");
      localStorage.removeItem("quiz_active_session_history");
      localStorage.removeItem("eng11_thpt_vinhtuan_active_session");

      const cloudUrl = getCloudUrl();
      if (cloudUrl) {
        try {
          await fetch(`${cloudUrl}/active_sessions.json`, { method: "DELETE" });
          await fetch(`${cloudUrl}/submissions.json`, { method: "DELETE" });
        } catch(e) {}
      }
    },

    onMessage(callback) {
      if (bc) {
        bc.onmessage = (event) => callback(event.data);
      }
      window.addEventListener("storage", (e) => {
        if (e.key === LIVE_SESSIONS_LOCAL_KEY || e.key === "quiz_submissions_v2") {
          callback({ type: "STORAGE_CHANGE", key: e.key });
        }
      });
    }
  };

  window.Telemetry = Telemetry;
})(window);
