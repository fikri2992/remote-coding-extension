import fs from 'fs/promises'
import path from 'path'

export type TerminalCommandStatus = 'running' | 'exited' | 'killed' | 'released' | 'error'

export interface TerminalCommandRecord {
  id: string // identical to terminalId for simplicity
  terminalId: string
  command: string
  args: string[]
  cwd?: string
  status: TerminalCommandStatus
  createdAt: number
  updatedAt: number
  exitCode?: number
  signal?: string
}

export default class TerminalCommandsStore {
  private filePath: string
  private items: Map<string, TerminalCommandRecord> = new Map()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init() {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true })
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        for (const it of parsed) {
          if (it && it.id) this.items.set(String(it.id), it as TerminalCommandRecord)
        }
      }
    } catch {
      // initialize empty file
      await this.flush()
    }
  }

  private async flush() {
    const list = Array.from(this.items.values())
    await fs.writeFile(this.filePath, JSON.stringify(list, null, 2), 'utf8')
  }

  list(): TerminalCommandRecord[] {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  async upsert(rec: TerminalCommandRecord) {
    this.items.set(rec.id, { ...rec, updatedAt: Date.now() })
    await this.flush()
  }

  async update(id: string, patch: Partial<TerminalCommandRecord>) {
    const prev = this.items.get(id)
    if (!prev) return
    const next = { ...prev, ...patch, updatedAt: Date.now() }
    this.items.set(id, next)
    await this.flush()
  }

  async remove(id: string) {
    this.items.delete(id)
    await this.flush()
  }

  async clear() {
    this.items.clear()
    await this.flush()
  }
}
