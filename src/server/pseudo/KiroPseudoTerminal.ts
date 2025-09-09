import * as vscode from 'vscode'
import { SessionEngine, SessionOptions } from './SessionEngine'

export class KiroPseudoTerminal implements vscode.Pseudoterminal {
  private onDidWriteEmitter = new vscode.EventEmitter<string>()
  onDidWrite: vscode.Event<string> = this.onDidWriteEmitter.event
  private onDidCloseEmitter = new vscode.EventEmitter<void>()
  onDidClose?: vscode.Event<void> = this.onDidCloseEmitter.event

  private created = false

  constructor(
    private engine: SessionEngine,
    private sid: string,
    private opts: SessionOptions
  ) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    const sink = (chunk: string) => this.onDidWriteEmitter.fire(chunk)
    if (!this.created) {
      this.engine.create(this.sid, this.opts, sink)
      if (this.opts.mode === 'pipe') {
        try { (this.engine as any).startPipeShell?.(this.sid) } catch {}
      }
      this.created = true
    } else {
      this.engine.attach(this.sid, sink)
      this.engine.open(this.sid, initialDimensions && { cols: initialDimensions.columns, rows: initialDimensions.rows })
    }
  }

  close(): void {
    try { this.engine.dispose(this.sid) } catch {}
    this.onDidCloseEmitter.fire()
  }

  handleInput(data: string): void {
    this.engine.input(this.sid, data)
  }

  setDimensions(d: vscode.TerminalDimensions): void {
    this.engine.resize(this.sid, d.columns, d.rows)
  }
}
