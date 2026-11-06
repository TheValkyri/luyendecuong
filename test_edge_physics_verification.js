const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

async function runEdgePhysicsVerification() {
  console.log('--- Launching real Microsoft Edge (Chromium) in headless mode for Physics & App verification ---');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const tmpProfile = path.join(os.tmpdir(), 'edge-verify-phy-' + Date.now());
  const port = 9334;

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
        console.log(`[EDGE CONSOLE ${type.toUpperCase()}]:`, args.slice(0, 120));
      }
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const htmlFile = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  console.log('Navigating Edge to:', htmlFile);

  await send('Page.navigate', { url: htmlFile });

  // Wait 3 seconds for page scripts, KaTeX, and audio init
  await new Promise(r => setTimeout(r, 3000));

  console.log('Executing test suite inside real Microsoft Edge browser...');
  const testExpr = `
    (async function() {
      try {
        const out = {};

        // 1. Switch to English
        AppState.studentName = "Nguyen Van Test - 11A1";
        const nameInput = document.getElementById("txtStudentName");
        if (nameInput) nameInput.value = "Nguyen Van Test - 11A1";
        startExam();

        out.englishActiveQuestionsIsNull = (AppState.activeQuestions === null);
        out.englishTotalQuestions = getActiveQuestionsSubset().length;
        
        // Go back to welcome
        renderWelcomeScreen();

        // 2. Switch to Physics
        switchSubject('physics');
        const phyNameInput = document.getElementById("txtStudentName");
        if (phyNameInput) phyNameInput.value = "Nguyen Van Test - 11A1";
        startExam();

        out.physicsActiveQuestionsIsArray = Array.isArray(AppState.activeQuestions);
        out.physicsCount = AppState.activeQuestions ? AppState.activeQuestions.length : 0;
        out.physicsFirstLabel = AppState.activeQuestions ? AppState.activeQuestions[0].label : null;
        out.physicsFirstDisplayNum = AppState.activeQuestions ? AppState.activeQuestions[0].displayNum : null;
        out.physicsFirstId = AppState.activeQuestions ? AppState.activeQuestions[0].id : null;

        // 3. Check DOM Card Rendering in Shuffled Mode
        const firstCardTag = document.querySelector('.q-idx-tag');
        out.renderedCardTagText = firstCardTag ? firstCardTag.textContent.trim() : null;

        // 4. Test Navigation
        navigateQuestion(1);
        out.activeIdxAfterNext = AppState.activeQuestionGlobalIdx;

        // 5. Matrix Drawer Check
        openMatrixSheet();
        const matrixButtons = document.querySelectorAll('#matrixGrid .matrix-cell');
        out.matrixButtonCount = matrixButtons.length;
        closeMatrixSheet();

        // 6. Finalize Exam & Result Screen
        AppState.userAnswers[AppState.activeQuestions[0].id] = AppState.activeQuestions[0].answer;
        finalizeExam();
        out.isFinished = AppState.isFinished;
        out.reviewRecordExists = !!currentReviewRecord;
        out.breakdownLength = currentReviewRecord ? currentReviewRecord.breakdown.length : 0;
        out.reviewFirstLabel = currentReviewRecord ? currentReviewRecord.breakdown[0].label : null;
        out.reviewScore = currentReviewRecord ? currentReviewRecord.correctMCQ : 0;

        return out;
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()
  `;

  const evalResult = await send('Runtime.evaluate', {
    expression: testExpr,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('\n--- Real Edge In-Browser Evaluation Results ---');
  console.log(JSON.stringify(evalResult.result.value, null, 2));

  await new Promise(r => setTimeout(r, 1000));

  ws.close();
  edgeProcess.kill();

  const results = evalResult.result.value;

  // Assertions
  if (!results.englishActiveQuestionsIsNull) {
    console.error('FAIL: English questions were shuffled when they should not be!');
    process.exit(1);
  }
  if (results.physicsCount !== 160) {
    console.error(`FAIL: Physics questions count expected 160, got ${results.physicsCount}`);
    process.exit(1);
  }
  if (results.physicsFirstLabel !== 'Câu 1' || results.physicsFirstDisplayNum !== 1) {
    console.error(`FAIL: Physics first question label is not 'Câu 1'! Got: ${results.physicsFirstLabel}`);
    process.exit(1);
  }
  if (!results.renderedCardTagText || !results.renderedCardTagText.startsWith('Câu 1 (1 / 160)')) {
    console.error(`FAIL: Rendered card tag text does not match 'Câu 1 (1 / 160)'! Got: ${results.renderedCardTagText}`);
    process.exit(1);
  }
  if (results.matrixButtonCount !== 160) {
    console.error(`FAIL: Matrix button count expected 160, got ${results.matrixButtonCount}`);
    process.exit(1);
  }
  if (!results.isFinished || results.breakdownLength !== 160 || results.reviewFirstLabel !== 'Câu 1') {
    console.error('FAIL: Exam finalization or review breakdown incorrect!');
    process.exit(1);
  }
  if (uncaughtExceptions.length > 0) {
    console.error('FAIL: Uncaught exceptions were detected in Edge:', uncaughtExceptions);
    process.exit(1);
  }

  console.log('\nSUCCESS: Real Microsoft Edge Chromium verified ALL Deliverable A & B features with 0 exceptions!');
  process.exit(0);
}

runEdgePhysicsVerification().catch(err => {
  console.error('Edge physics verification fatal error:', err);
  process.exit(1);
});
