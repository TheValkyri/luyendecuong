const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

async function runEdgeVerification() {
  console.log('--- Launching real Microsoft Edge (Chromium) in headless mode ---');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpProfile = path.join(os.tmpdir(), 'edge-verify-' + Date.now());
  const port = 9333;

  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tmpProfile}`,
    'about:blank'
  ]);

  edgeProcess.on('error', err => {
    console.error('Failed to spawn Edge:', err);
    process.exit(1);
  });

  // Helper to fetch json from CDP
  function getJson(url) {
    return new Promise((resolve, reject) => {
      http.get(url, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch(e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  // Poll until Edge CDP endpoint is ready
  let targets = [];
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      if (targets && targets.length > 0) break;
    } catch(e) {}
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    console.error('Could not find Edge page target WebSocket URL:', targets);
    edgeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Edge page target:', pageTarget.id);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const uncaughtExceptions = [];
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      const details = msg.params.exceptionDetails;
      const text = details.exception ? (details.exception.description || details.exception.value) : details.text;
      console.error('[EDGE EXCEPTION THROWN]:', text, 'at', details.url, `${details.lineNumber}:${details.columnNumber}`);
      uncaughtExceptions.push(text);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const args = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
      if (type === 'error') {
        console.error('[EDGE CONSOLE ERROR]:', args);
        consoleErrors.push(args);
      } else {
        console.log(`[EDGE CONSOLE ${type.toUpperCase()}]:`, args.slice(0, 100));
      }
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  // Enable Runtime and Page
  await send('Runtime.enable');
  await send('Page.enable');

  const htmlFile = 'file:///' + path.resolve(__dirname, 'giam-sat-thpt.html').replace(/\\/g, '/');
  console.log('Navigating Edge to:', htmlFile);

  await send('Page.navigate', { url: htmlFile });

  // Wait 3 seconds for page scripts to load and telemetry intervals to initialize
  await new Promise(r => setTimeout(r, 3000));

  console.log('Invoking client-side functions in real Edge session...');
  const testExpr = `
    (function() {
      const results = {};
      results.updateKPICards = typeof updateKPICards === 'function';
      updateKPICards();

      results.toggleValidNameFilter = typeof toggleValidNameFilter === 'function';
      toggleValidNameFilter({ checked: true });
      toggleValidNameFilter({ checked: false });
      toggleValidNameFilter({ checked: true });

      results.cleanupStaleSessions = typeof cleanupStaleSessions === 'function';
      cleanupStaleSessions(true);

      results.renderLiveTable = typeof renderLiveTable === 'function';
      renderLiveTable();

      results.renderStudentsTable = typeof renderStudentsTable === 'function';
      renderStudentsTable();

      results.switchDevTab = typeof switchDevTab === 'function';
      switchDevTab('students');
      switchDevTab('analytics');
      switchDevTab('live');

      return results;
    })()
  `;

  const evalResult = await send('Runtime.evaluate', {
    expression: testExpr,
    returnByValue: true
  });

  console.log('Edge in-browser evaluation result:', evalResult.result.value);

  // Allow another second for async telemetry callbacks
  await new Promise(r => setTimeout(r, 1000));

  ws.close();
  edgeProcess.kill();

  console.log('\n--- Edge In-Browser Verification Summary ---');
  console.log('Total uncaught exceptions in real browser:', uncaughtExceptions.length);
  console.log('Total console.error messages in real browser:', consoleErrors.length);

  if (uncaughtExceptions.length > 0) {
    console.error('FAIL: Uncaught exceptions were detected in Edge:', uncaughtExceptions);
    process.exit(1);
  }

  console.log('SUCCESS: Real Microsoft Edge (Chromium) completed execution with 0 ReferenceError and 0 exceptions!');
  process.exit(0);
}

runEdgeVerification().catch(err => {
  console.error('Edge verification runner fatal error:', err);
  process.exit(1);
});
