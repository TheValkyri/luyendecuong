import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  const screenshotsDir = path.resolve(process.cwd(), 'docs', 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Visit Student Lobby at http://localhost:5173/
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="student-lobby-view"]');
  await page.waitForSelector('[data-testid^="select-exam-"]');

  // Fill in candidate name
  await page.getByTestId('student-name-input').fill('Nguyễn Ái Thuận Yến');
  await page.getByTestId('student-class-input').fill('11 Lý Chuyên');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(screenshotsDir, '13-ly11-lobby-student.png'),
    fullPage: false,
  });

  // 2. Start Exam Session
  await page.getByTestId('enter-exam-btn').click();
  await page.waitForSelector('[data-testid="student-workspace-view"]');
  await page.waitForTimeout(400);

  await page.screenshot({
    path: path.join(screenshotsDir, '14-ly11-active-exam-randomized.png'),
    fullPage: false,
  });

  // 3. Find and navigate to a question with a diagram (e.g. q_ly11_cd1_029, 034 or similar)
  // Let's click question navigation map or next until diagram is visible
  let foundDiagram = false;
  for (let i = 0; i < 20; i++) {
    const zoomBtn = page.getByTestId('zoom-diagram-btn');
    if ((await zoomBtn.count()) > 0) {
      foundDiagram = true;
      break;
    }
    await page.getByTestId('next-question-btn').click();
    await page.waitForTimeout(100);
  }

  if (foundDiagram) {
    await page.screenshot({
      path: path.join(screenshotsDir, '15-ly11-diagram-question.png'),
      fullPage: false,
    });

    await page.getByTestId('zoom-diagram-btn').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(screenshotsDir, '16-ly11-diagram-zoom-modal.png'),
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  // 4. Visit Admin Route at http://localhost:5173/admin
  await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="admin-top-navbar"]');
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(screenshotsDir, '17-admin-portal-clean.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
