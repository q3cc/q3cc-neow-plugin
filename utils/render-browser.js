import fs from 'fs'

let puppeteerModulePromise
let browserPromise

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadPuppeteer() {
  if (!puppeteerModulePromise) {
    puppeteerModulePromise = (async () => {
      try {
        const module = await import('puppeteer')
        return {
          puppeteer: module.default || module,
          isCore: false
        }
      } catch {
        const module = await import('puppeteer-core')
        return {
          puppeteer: module.default || module,
          isCore: true
        }
      }
    })().catch(error => {
      puppeteerModulePromise = null
      throw error
    })
  }

  return puppeteerModulePromise
}

function getExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe'
  ].filter(Boolean)

  return candidates.find(file => {
    try {
      return fs.existsSync(file)
    } catch {
      return false
    }
  })
}

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { puppeteer, isCore } = await loadPuppeteer()
      const executablePath = getExecutablePath()

      if (isCore && !executablePath) {
        throw new Error('未找到可用的 Chromium 或 Chrome 可执行文件')
      }

      const launchOptions = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ]
      }

      if (executablePath) {
        launchOptions.executablePath = executablePath
      }

      let browser

      try {
        browser = await puppeteer.launch({
          ...launchOptions,
          headless: 'new'
        })
      } catch {
        browser = await puppeteer.launch({
          ...launchOptions,
          headless: true
        })
      }

      browser.on?.('disconnected', () => {
        browserPromise = null
      })

      return browser
    })().catch(error => {
      browserPromise = null
      throw error
    })
  }

  return browserPromise
}
