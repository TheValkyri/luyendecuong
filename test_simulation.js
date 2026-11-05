const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, 'giam-sat-thpt.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract all id attributes from the HTML
const idRegex = /id=["']([^"']+)["']/g;
const allIds = new Set();
let match;
while ((match = idRegex.exec(htmlContent)) !== null) {
  allIds.add(match[1]);
}

// Mock DOM element factory
function createElement(tag = 'div', id = '') {
  return {
    tagName: tag.toUpperCase(),
    id: id,
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    style: {},
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    parentElement: null,
    children: [],
    querySelectorAll(selector) {
      return [];
    },
    querySelector(selector) {
      return null;
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

const elementsMap = {};
allIds.forEach(id => {
  elementsMap[id] = createElement('div', id);
});

// Mock document
const document = {
  getElementById(id) {
    if (!elementsMap[id]) {
      elementsMap[id] = createElement('div', id);
    }
    return elementsMap[id];
  },
  querySelectorAll(selector) {
    if (selector === '.chk-valid-name-toggle') {
      return [elementsMap['chkValidNames'] || createElement('input')];
    }
    return [];
  },
  querySelector(selector) {
    return null;
  },
  createElement(tag) {
    return createElement(tag);
  },
  addEventListener() {}
};

const storageStore = {};
const mockStorage = {
  getItem(k) { return storageStore[k] || null; },
  setItem(k, v) { storageStore[k] = String(v); },
  removeItem(k) { delete storageStore[k]; },
  clear() { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

// Mock window and context
const windowObj = {
  location: {
    search: '?v=20261105_2255',
    pathname: '/giam-sat-thpt.html',
    hash: '',
    replace() {}
  },
  localStorage: mockStorage,
  sessionStorage: mockStorage,
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  },
  setInterval() {},
  clearInterval() {},
  setTimeout(fn) { return fn; },
  clearTimeout() {},
  alert() {},
  confirm() { return true; },
  console: console,
  document: document,
  Date: Date,
  Math: Math,
  Set: Set,
  Map: Map,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  URLSearchParams: URLSearchParams,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
};
windowObj.window = windowObj;

const context = vm.createContext(windowObj);

console.log('--- 1. Testing Syntax of external scripts ---');
const externalScripts = [
  'quiz_data.js',
  'physics_quiz_data.js',
  'history_quiz_data.js',
  'telemetry_sync.js'
];

externalScripts.forEach(scriptFile => {
  const scriptPath = path.join(__dirname, scriptFile);
  if (fs.existsSync(scriptPath)) {
    const code = fs.readFileSync(scriptPath, 'utf8');
    try {
      new vm.Script(code, { filename: scriptFile });
      console.log(`[PASS] Syntax check passed: ${scriptFile}`);
      vm.runInContext(code, context);
      console.log(`[PASS] Execution passed: ${scriptFile}`);
    } catch (e) {
      console.error(`[FAIL] Error in ${scriptFile}:`, e);
      process.exit(1);
    }
  } else {
    console.warn(`[WARN] File not found: ${scriptFile}`);
  }
});

console.log('\n--- 2. Testing Syntax & Execution of inline scripts in giam-sat-thpt.html ---');
const scriptTagRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let inlineScriptIdx = 0;
while ((match = scriptTagRegex.exec(htmlContent)) !== null) {
  inlineScriptIdx++;
  const inlineCode = match[1];
  console.log(`Checking inline script #${inlineScriptIdx} (${inlineCode.trim().slice(0, 40)}...)`);
  try {
    new vm.Script(inlineCode, { filename: `inline-script-${inlineScriptIdx}.js` });
    console.log(`[PASS] Syntax check passed for inline script #${inlineScriptIdx}`);
    vm.runInContext(inlineCode, context);
    console.log(`[PASS] Execution passed for inline script #${inlineScriptIdx}`);
  } catch (e) {
    console.error(`[FAIL] Error in inline script #${inlineScriptIdx}:`, e);
    process.exit(1);
  }
}

console.log('\n--- 3. Testing updateKPICards() across multiple scenarios ---');

// Scenario A: Empty state (0 submissions, 0 active sessions)
console.log('Testing Scenario A: 0 submissions, 0 active sessions');
vm.runInContext(`
  allSubmissionsList = [];
  activeSessionsMap = {};
  updateKPICards();
`, context);

if (document.getElementById('kpiOnlineCount').textContent !== 0) throw new Error('kpiOnlineCount mismatch');
if (document.getElementById('kpiTotalSubmissions').textContent !== 0) throw new Error('kpiTotalSubmissions mismatch');
if (document.getElementById('kpiAvgScore').textContent !== '0.0') throw new Error('kpiAvgScore mismatch');
if (document.getElementById('badgeStudentCount').textContent !== 0) throw new Error('badgeStudentCount mismatch');
console.log('[PASS] Scenario A passed');

// Scenario B: Fallback state (0 submissions, 2 active sessions with scores)
console.log('Testing Scenario B: 0 submissions, 2 active sessions (1 online, 1 idle) with scores');
const now = Date.now();
vm.runInContext(`
  activeSessionsMap = {
    sess1: {
      sessionId: 'sess1',
      studentName: 'Nguyễn Văn A',
      subject: 'english',
      provisionalGrade10: 8.5,
      lastActive: ${now - 30000} // 30s ago (truly online)
    },
    sess2: {
      sessionId: 'sess2',
      studentName: 'Trần Thị B',
      subject: 'physics',
      provisionalGrade10: 9.0,
      lastActive: ${now - 400000} // ~6.6 min ago (idle)
    }
  };
  filterValidNamesOnly = true;
  updateKPICards();
`, context);

console.log('kpiOnlineCount:', document.getElementById('kpiOnlineCount').textContent); // should be 1
console.log('kpiAvgScore:', document.getElementById('kpiAvgScore').textContent);
console.log('kpiMaxScore:', document.getElementById('kpiMaxScore').textContent);
console.log('kpiPassRate:', document.getElementById('kpiPassRate').textContent);
console.log('badgeStudentCount:', document.getElementById('badgeStudentCount').textContent); // should be 2

if (document.getElementById('kpiOnlineCount').textContent !== 1) throw new Error('Online count should be 1 (only truly online)');
if (document.getElementById('badgeStudentCount').textContent !== 2) throw new Error('badgeStudentCount should be 2');
console.log('[PASS] Scenario B passed');

// Scenario B2: 0 submissions, 0 truly online, 1 idle session with score
console.log('Testing Scenario B2: 0 submissions, 0 online, 1 idle session with score');
vm.runInContext(`
  allSubmissionsList = [];
  activeSessionsMap = {
    sess_idle: {
      sessionId: 'sess_idle',
      studentName: 'Hoàng Văn E',
      subject: 'english',
      provisionalGrade10: 7.0,
      lastActive: ${now - 600000} // 10 min ago
    }
  };
  filterValidNamesOnly = true;
  updateKPICards();
`, context);

console.log('Scenario B2 kpiOnlineCount:', document.getElementById('kpiOnlineCount').textContent); // 0
console.log('Scenario B2 kpiAvgScore:', document.getElementById('kpiAvgScore').textContent); // 7.0
console.log('Scenario B2 badgeStudentCount:', document.getElementById('badgeStudentCount').textContent); // 1
if (document.getElementById('kpiOnlineCount').textContent !== 0) throw new Error('Scenario B2 kpiOnlineCount mismatch');
if (document.getElementById('kpiAvgScore').textContent !== '7.0') throw new Error('Scenario B2 kpiAvgScore mismatch');
if (document.getElementById('badgeStudentCount').textContent !== 1) throw new Error('Scenario B2 badgeStudentCount mismatch');
console.log('[PASS] Scenario B2 passed');

// Scenario B3: 0 submissions, 1 online student with provisionalGrade10 = 0
console.log('Testing Scenario B3: 0 submissions, 1 online student with provisionalGrade10 = 0');
vm.runInContext(`
  allSubmissionsList = [];
  activeSessionsMap = {
    sess_zero: {
      sessionId: 'sess_zero',
      studentName: 'Vũ Thị F',
      subject: 'physics',
      provisionalGrade10: 0,
      lastActive: ${now - 10000} // 10s ago
    }
  };
  filterValidNamesOnly = true;
  updateKPICards();
`, context);

console.log('Scenario B3 kpiOnlineCount:', document.getElementById('kpiOnlineCount').textContent); // 1
console.log('Scenario B3 kpiAvgScore:', document.getElementById('kpiAvgScore').textContent); // 0.0
console.log('Scenario B3 kpiPassRate:', document.getElementById('kpiPassRate').textContent); // "Đang chờ học sinh làm bài"
if (document.getElementById('kpiPassRate').textContent !== 'Đang chờ học sinh làm bài') throw new Error('Scenario B3 kpiPassRate mismatch');
console.log('[PASS] Scenario B3 passed');

// Scenario C: Submissions exist (3 submissions, 2 active sessions)
console.log('Testing Scenario C: 3 submissions, 2 active sessions');
vm.runInContext(`
  allSubmissionsList = [
    { studentName: 'Nguyễn Văn A', grade10: 8.0, subject: 'english', timestamp: ${now - 100000} },
    { studentName: 'Lê Văn C', grade10: 6.0, subject: 'history', timestamp: ${now - 200000} },
    { studentName: 'Phạm Thị D', grade10: 4.5, subject: 'physics', timestamp: ${now - 300000} }
  ];
  updateKPICards();
`, context);

console.log('Total submissions:', document.getElementById('kpiTotalSubmissions').textContent);
console.log('kpiAvgScore:', document.getElementById('kpiAvgScore').textContent);
console.log('badgeStudentCount:', document.getElementById('badgeStudentCount').textContent); // Nguyễn Văn A, Trần Thị B, Lê Văn C, Phạm Thị D = 4

if (document.getElementById('kpiTotalSubmissions').textContent !== 3) throw new Error('kpiTotalSubmissions should be 3');
if (document.getElementById('badgeStudentCount').textContent !== 4) throw new Error('badgeStudentCount should be 4');
console.log('[PASS] Scenario C passed');

// Scenario D: Name filter testing (valid vs troll names)
console.log('Testing Scenario D: Spam / troll names filtering');
vm.runInContext(`
  allSubmissionsList.push({
    studentName: 'oc cho oc cho',
    grade10: 1.0,
    subject: 'english',
    timestamp: ${now}
  });
  activeSessionsMap['sess_spam'] = {
    sessionId: 'sess_spam',
    studentName: 'bo liem oc cho',
    subject: 'english',
    lastActive: ${now},
    provisionalGrade10: 2.0
  };

  filterValidNamesOnly = true;
  updateKPICards();
`, context);
const countWithFilter = document.getElementById('badgeStudentCount').textContent;
console.log('Unique students with filter ON:', countWithFilter); // should remain 4
if (countWithFilter !== 4) throw new Error(`Expected 4 valid students with filter ON, got ${countWithFilter}`);

vm.runInContext(`
  filterValidNamesOnly = false;
  updateKPICards();
`, context);
const countWithoutFilter = document.getElementById('badgeStudentCount').textContent;
console.log('Unique students with filter OFF:', countWithoutFilter); // should be 6
if (countWithoutFilter !== 6) throw new Error(`Expected 6 students with filter OFF, got ${countWithoutFilter}`);
console.log('[PASS] Scenario D passed');

// Scenario E: toggleValidNameFilter and cleanupStaleSessions
console.log('\n--- 4. Testing event handlers & table rendering ---');
vm.runInContext(`
  toggleValidNameFilter({ checked: true });
`, context);
console.log('[PASS] toggleValidNameFilter({ checked: true }) passed');

vm.runInContext(`
  cleanupStaleSessions(true); // silent = true
`, context);
console.log('[PASS] cleanupStaleSessions(true) passed');

vm.runInContext(`
  renderLiveTable();
`, context);
console.log('[PASS] renderLiveTable() passed');

vm.runInContext(`
  renderStudentsTable();
`, context);
console.log('[PASS] renderStudentsTable() passed');

console.log('\n========================================');
console.log('ALL TESTS PASSED! 0 ReferenceError, 0 SyntaxError.');
console.log('========================================');
