import * as vscode from 'vscode'
import { SessionEngine } from '../server/pseudo/SessionEngine'

export function registerDiagnosePtyCommand(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand('webAutomationTunnel.diagnosePTY', async () => {
    const out = vscode.window.createOutputChannel('Kiro Remote: PseudoTerminal Diagnosis')
    out.clear()
    out.show(true)

    const info = {
      platform: process.platform,
      arch: process.arch,
      versions: {
        node: process.versions.node,
        electron: (process.versions as any).electron || 'n/a',
        modules: process.versions.modules,
        v8: process.versions.v8,
      }
    }
    out.appendLine('=== PseudoTerminal Diagnosis ===')
    out.appendLine(JSON.stringify(info, null, 2))

    // Basic SessionEngine echo test
    const engine = new SessionEngine()
    const sid = `diag_${Date.now().toString(36)}`
    let buffer = ''
    const cfg = vscode.workspace.getConfiguration('webAutomationTunnel')
    const promptEnabled = cfg.get<boolean>('terminal.prompt.enabled', true) ?? true
    const hiddenEchoEnabled = cfg.get<boolean>('terminal.hiddenEcho.enabled', true) ?? true
    engine.create(sid, { cwd: process.cwd(), env: process.env as any, mode: 'line', interceptClear: true, promptEnabled, hiddenEchoEnabled }, (chunk) => {
      buffer += String(chunk)
    })
    engine.input(sid, 'echo PSEUDO_OK\r')
    await new Promise<void>(resolve => setTimeout(resolve, 800))
    engine.dispose(sid)

    const ok = /PSEUDO_OK/.test(buffer)
    out.appendLine('SessionEngine line-mode echo test: ' + (ok ? 'OK' : 'FAILED'))
    vscode.window.showInformationMessage(ok ? 'PseudoTerminal OK' : 'PseudoTerminal test failed (see Output)')
  })
  context.subscriptions.push(cmd)
}
