import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'

export type SessionMode = 'line' | 'pipe'

export type SessionOptions = {
  cwd: string
  env: NodeJS.ProcessEnv
  mode: SessionMode
  interceptClear?: boolean
  shell?: string
  shellArgs?: string[]
  promptEnabled?: boolean
  hiddenEchoEnabled?: boolean
}

type Sink = (chunk: string) => void

type Session = {
  id: string
  cwd: string
  env: NodeJS.ProcessEnv
  mode: SessionMode
  sink: Sink
  lineBuffer: string
  child?: ChildProcess
  interceptClear: boolean
  shell?: string
  shellArgs?: string[]
  promptEnabled: boolean
  hiddenEchoEnabled: boolean
  history: string[]
  historyIndex?: number | null
}

export class SessionEngine {
  private sessions = new Map<string, Session>()

  create(id: string, opts: SessionOptions, sink: Sink) {
    const s: Session = {
      id,
      cwd: opts.cwd,
      env: opts.env,
      mode: opts.mode,
      sink,
      lineBuffer: '',
      interceptClear: opts.interceptClear !== false, // default true
      ...(opts.shell !== undefined && { shell: opts.shell }),
      ...(opts.shellArgs !== undefined && { shellArgs: opts.shellArgs }),
      promptEnabled: opts.promptEnabled !== false,
      hiddenEchoEnabled: opts.hiddenEchoEnabled !== false,
      history: [],
      historyIndex: null,
    }
    this.sessions.set(id, s)
    // Initial prompt
    this.printPrompt(id)
  }

  attach(id: string, sink: Sink) {
    const s = this.sessions.get(id)
    if (!s) return
    s.sink = sink
  }

  open(_id: string, _dims?: { cols: number; rows: number }) {
    // no-op for line mode; reserved for pipe mode
  }

  input(id: string, data: string) {
    const s = this.sessions.get(id)
    if (!s) return
    // Ctrl+C
    if (data.includes('\u0003')) {
      this.cancel(id)
      return
    }
    if (s.mode === 'line') {
      // Local-echo line editor: process keystrokes and render in terminal
      let i = 0
      while (i < data.length) {
        const ch = data.charAt(i++)
        const code = ch.charCodeAt(0)
        // Arrow keys (CSI sequences)
        if (ch === '\u001b' && i < data.length && data[i] === '[') {
          i++
          if (i < data.length) {
            const c = data.charAt(i++)
            if (c === 'A' || c === 'B') {
              // Up/Down history
              if (c === 'A') {
                if (s.history.length > 0) {
                  s.historyIndex = (s.historyIndex == null) ? s.history.length - 1 : Math.max(0, s.historyIndex - 1)
                  s.lineBuffer = s.historyIndex != null ? (s.history[s.historyIndex!] ?? '') : ''
                }
              } else if (c === 'B') {
                if (s.historyIndex == null) {
                  s.lineBuffer = ''
                } else if (s.historyIndex < s.history.length - 1) {
                  s.historyIndex++
                  s.lineBuffer = s.history[s.historyIndex!] ?? ''
                } else {
                  s.historyIndex = null
                  s.lineBuffer = ''
                }
              }
              this.renderEditLine(id)
              continue
            }
          }
          continue
        }
        // Backspace (DEL 0x7f or BS 0x08)
        if (code === 0x7f || code === 0x08) {
          if (s.lineBuffer.length > 0) {
            s.lineBuffer = s.lineBuffer.slice(0, -1)
            if (s.hiddenEchoEnabled) this.sink(id, '\b \b')
          }
          continue
        }
        // Enter (CR or LF)
        if (ch === '\r' || ch === '\n') {
          this.sink(id, '\r\n')
          const submit = s.lineBuffer
          s.lineBuffer = ''
          s.historyIndex = null
          this.handleLine(id, submit)
          continue
        }
        // Tab: pass-through
        if (ch === '\t') {
          s.lineBuffer += '\t'
          if (s.hiddenEchoEnabled) this.sink(id, '\t')
          continue
        }
        // Printable
        if (code >= 0x20) {
          s.lineBuffer += ch
          if (s.hiddenEchoEnabled) this.sink(id, ch)
        }
      }
    } else {
      // pipe mode
      const child = s.child
      if (!child) return
      // Intercept clear/cls
      const trimmed = data.trim().toLowerCase()
      if (s.interceptClear && (trimmed === 'clear' || trimmed === 'cls' || /clear\r|clear\n/.test(data))) {
        // Inject ANSI clear and do not forward 'clear' to shell
        this.sink(id, '\u001b[2J\u001b[H')
        try { child.stdin?.write(process.platform === 'win32' ? '\r\n' : '\n') } catch {}
        return
      }
      // Normalize Windows CR-only to CRLF
      if (process.platform === 'win32') {
        data = data.replace(/\r(?!\n)/g, '\r\n')
      }
      if (child?.stdin) {
        try { child.stdin.write(data) } catch {}
      }
    }
  }

  resize(_id: string, _cols: number, _rows: number) {
    // no-op for pseudo terminal line mode
  }

  dispose(id: string) {
    const s = this.sessions.get(id)
    if (!s) return
    try { s.child?.kill() } catch {}
    this.sessions.delete(id)
  }

  private handleLine(id: string, raw: string) {
    const s = this.sessions.get(id)
    if (!s) return
    const line = (raw || '').trim()
    if (!line) {
      // Empty line → just reprint prompt
      this.sink(id, '\r\n')
      this.printPrompt(id)
      return
    }

    // History push (dedupe consecutive)
    if (line.length > 0) {
      const last = s.history.length > 0 ? s.history[s.history.length - 1] : undefined
      if (last !== line) s.history.push(line)
      if (s.history.length > 200) s.history = s.history.slice(-200)
    }

    // Intercept clear/cls
    if (s.interceptClear && (line === 'clear' || line === 'cls')) {
      this.clear(id)
      return
    }

    // Builtin: cd
    if (line.startsWith('cd ')) {
      const target = line.slice(3).trim()
      // (local echo already rendered while typing)
      this.cd(id, target)
      return
    }

    // Execute via shell
    // (local echo already rendered while typing)
    const child = spawn(line, { shell: true, cwd: s.cwd, env: s.env })
    s.child = child
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (b: string) => this.sink(id, b))
    child.stderr?.on('data', (b: string) => this.sink(id, b))
    child.on('close', (code: number) => {
      this.sink(id, `\r\n[exit ${code}]\r\n`)
      delete s.child
      this.printPrompt(id)
    })
  }

  // Pipe shell: start a long-lived shell connected via pipes
  startPipeShell(id: string) {
    const s = this.sessions.get(id)
    if (!s) return
    if (s.mode !== 'pipe') return
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
    const args = process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : ['-i']
    const child = spawn(s.shell || shell, s.shellArgs || args, { cwd: s.cwd, env: s.env })
    s.child = child
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (b: string) => this.sink(id, b))
    child.stderr?.on('data', (b: string) => this.sink(id, b))
    child.on('close', (code: number) => {
      this.sink(id, `\r\n[exit ${code}]\r\n`)
      delete s.child
      // Print a fresh prompt for consistency
      this.printPrompt(id)
    })
  }

  private cancel(id: string) {
    const s = this.sessions.get(id)
    if (!s) return
    if (s.child && !s.child.killed) {
      try { s.child.kill() } catch {}
      this.sink(id, '\r\n^C\r\n')
      delete s.child
    }
    this.printPrompt(id)
  }

  private clear(id: string) {
    this.sink(id, '\u001b[2J\u001b[H')
    this.printPrompt(id)
  }

  private cd(id: string, target: string) {
    const s = this.sessions.get(id)
    if (!s) return
    const next = path.isAbsolute(target) ? target : path.join(s.cwd, target)
    try {
      s.cwd = next
    } catch {}
    this.printPrompt(id)
  }

  private printPrompt(id: string) {
    const s = this.sessions.get(id)
    if (!s) return
    if (s.promptEnabled) this.sink(id, `\u001b[36m${s.cwd}\u001b[0m$ `)
  }

  private hiddenEcho(id: string, text: string) {
    this.sink(id, `\u001b[2m${text}\u001b[0m\r\n`)
  }

  private sink(id: string, chunk: string) {
    const s = this.sessions.get(id)
    if (!s) return
    try { s.sink(chunk) } catch {}
  }

  private renderEditLine(id: string) {
    const s = this.sessions.get(id)
    if (!s) return
    this.sink(id, '\r\x1b[K')
    this.printPrompt(id)
    if (s.hiddenEchoEnabled && s.lineBuffer) this.sink(id, s.lineBuffer)
  }
}
