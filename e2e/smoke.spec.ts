import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/** Answer whatever question is on screen, without knowing the right answer. */
async function answerCurrent(win: Page): Promise<void> {
  const label = (await win.locator('span.rounded-full.bg-accent-soft').first().textContent()) ?? ''
  switch (label.trim()) {
    case 'Multiple choice':
      await win.keyboard.press('1')
      break
    case 'True or false':
      await win.keyboard.press('t')
      break
    case 'Put in order':
      await win.getByRole('button', { name: 'Check order' }).click()
      break
    case 'Blurt it out':
      await win.locator('#blurt').fill('No nucleus and 70S ribosomes')
      await win.getByRole('button', { name: 'Mark it' }).click()
      await win.getByRole('button', { name: /^Done/ }).click()
      break
    case 'Match up':
      for (let tries = 0; tries < 40; tries++) {
        const left = win
          .locator('.grid.grid-cols-2 > div')
          .first()
          .locator('button:not([disabled])')
        if ((await left.count()) === 0) break
        await left.first().click()
        const right = win
          .locator('.grid.grid-cols-2 > div')
          .nth(1)
          .locator('button:not([disabled])')
        await right.nth(tries % (await right.count())).click()
        await win.waitForTimeout(450)
      }
      break
    default:
      throw new Error(`Unexpected question type: ${label}`)
  }
}

test('first run: import the sample deck, study, and keep progress', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'revisiontool-e2e-'))
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    REVISIONTOOL_USER_DATA: userData
  }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: ['.'], env })
  const errors: string[] = []
  try {
    const win = await app.firstWindow()
    win.on('pageerror', (e) => errors.push(e.message))

    await expect(win.getByRole('heading', { name: 'Make your first deck' })).toBeVisible()
    await win.getByRole('button', { name: 'Try the sample deck' }).click()
    await expect(win.getByRole('heading', { name: 'Cell Biology Starter' })).toBeVisible()

    await win.getByRole('button', { name: 'Study now' }).click()
    await expect(win.getByRole('button', { name: 'Leave lesson' })).toBeVisible()
    await win.waitForTimeout(600)

    let feedbacks = 0
    for (let step = 0; step < 12 && feedbacks < 4; step++) {
      await answerCurrent(win)
      const sheet = win.getByRole('status')
      await expect(sheet).toBeVisible()
      feedbacks++
      // Recall, blurt and match move on by themselves; the rest wait for Continue.
      if (await win.getByRole('button', { name: /Continue/ }).isVisible())
        await win.keyboard.press('Enter')
      await expect(sheet).toBeHidden({ timeout: 5000 })
      // Let the outgoing question finish its exit animation before reading the next one.
      await win.waitForTimeout(600)
    }
    expect(feedbacks).toBeGreaterThanOrEqual(4)

    await win.keyboard.press('Escape')
    await win.getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(win.getByRole('heading', { name: 'Cell Biology Starter' })).toBeVisible()
    const started = win.locator('dt', { hasText: 'Started' }).locator('xpath=following-sibling::dd')
    await expect(started).not.toHaveText('0')
    expect(errors).toEqual([])
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
