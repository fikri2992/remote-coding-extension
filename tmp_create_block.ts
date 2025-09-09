  private async create(clientId: string, id: string | undefined, data: any) {
    // Choose shell and cwd
    const sessionId: string = data.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cols: number = Number(data.cols || 80);
    const rows: number = Number(data.rows || 24);
    const cwdRaw: string | undefined = data.cwd;
    const cwd = cwdRaw ? (path.isAbsolute(cwdRaw) ? cwdRaw : path.join(this.getWorkspaceRoot(), cwdRaw)) : this.getWorkspaceRoot();
    const preferPwsh = process.platform === 'win32' && !!process.env.ComSpec;
    const shell = process.platform === 'win32'
      ? ((process.env.PWsh || process.env.PWSH || '') || 'powershell.exe')
      : (process.env.SHELL || '/bin/bash');
    const persistent: boolean = !!data.persistent;
    const cfg = vscode.workspace.getConfiguration('webAutomationTunnel');
    
    // Hardcoded credential injection flag (disabled by default for security)
    const inject = false || cfg.get<boolean>('terminal.injectAICredentials', false) || process.env.KIRO_INJECT_AI_CREDS === '1';
    
    const enhancedEnv = ({ ...process.env } as NodeJS.ProcessEnv);
    
    // Debug logging for session creation
    if (this.debug) {
      console.log(`ðŸ”§ Creating Terminal Session [${clientId.substring(0, 8)}...]:`, {
        sessionId,
        shell,
        cwd,
        cols,
        rows,
        persistent,
        credentialInjection: inject,
        ptyAvailable: !!nodePty
      });
    }
    if (inject) {
      Object.assign(enhancedEnv, this.credentialManager.getAllAICredentials());
    }
    if (!enhancedEnv.TERM) {
      // Ensure sane TERM for TUIs
      (enhancedEnv as any).TERM = 'xterm-256color';
    }

    // Pseudo engine branch (Solution 1): force with config or env
    const engineMode = (cfg.get<string>('terminal.engineMode', 'auto') || 'auto');
    const override = (process.env.KIRO_TERMINAL_ENGINE || '').toLowerCase();
    const requestedEngine = (String(data.engine || data.engineMode || '')).toLowerCase();
    const usePseudoLine = requestedEngine === 'line' || engineMode === 'line' || override === 'line';
    const usePseudoPipe = requestedEngine === 'pipe' || engineMode === 'pipe' || override === 'pipe';
    if (usePseudoLine || usePseudoPipe) {
      // Wire engine output to client with redaction and buffering
      let sw: SessionWrapper;
      const sink = (chunk: string) => {
        const text = this.redact(chunk);
        if (sw?.clientId) {
          const sent = this.sendToClient(sw.clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: text } });
          if (!sent) {
            sw.outputBuffer.push({ chunk: text, timestamp: Date.now() });
            if (sw.outputBuffer.length > 1000) sw.outputBuffer = sw.outputBuffer.slice(-800);
          }
        }
      };
      this.pseudoEngine.create(sessionId, { cwd, env: enhancedEnv, mode: usePseudoPipe ? 'pipe' : 'line', interceptClear: true }, sink);
      if (usePseudoPipe) {
        try { (this.pseudoEngine as any).startPipeShell?.(sessionId) } catch {}
      }

      const wrapper = {
        write: (d: string) => { try { this.pseudoEngine.input(sessionId, d); } catch {} },
        resize: (_c: number, _r: number) => { try { this.pseudoEngine.resize(sessionId, _c, _r); } catch {} },
        kill: () => { try { this.pseudoEngine.dispose(sessionId); } catch {} },
      } as any;

      sw = {
        sessionId,
        pty: wrapper,
        clientId,
        persistent,
        isFallback: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: [],
      };
      this.sessions.set(sessionId, sw);
      this.reply(clientId, id, { op: 'create', ok: true, sessionId, cwd, cols, rows, event: 'ready', note: 'pseudo-terminal', engine: usePseudoPipe ? 'pipe' : 'line', persistent, availableProviders: this.credentialManager.getAvailableAIProviders() });
      return;
    }

    // If node-pty is available, use it. Otherwise, fall back to a pipe-based persistent shell.
    if (nodePty) {
      try {
        const pty = nodePty.spawn(shell, process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : [], {
          name: 'xterm-color',
          cols,
          rows,
          cwd,
          env: enhancedEnv,
        });

        const sw: SessionWrapper = {
          sessionId,
          pty,
          clientId,
          persistent,
          isFallback: false,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          outputBuffer: [],
        };
        this.sessions.set(sessionId, sw);
        
        // Debug logging for successful PTY session creation
        if (this.debug) {
          console.log(`âœ… PTY Session Created [${clientId.substring(0, 8)}...]:`, {
            sessionId,
            totalSessions: this.sessions.size,
            mode: 'PTY'
          });
        }
        pty.onData((chunk: string) => {
          sw.lastActivity = Date.now();
          const redactedChunk = this.redact(chunk);
          const sent = sw.clientId ? this.sendToClient(sw.clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: redactedChunk } }) : false;
          
          // Debug logging for PTY data (without exposing content)
          if (this.debug && chunk.length > 0) {
            console.log(`ðŸ“¤ PTY Data [${sessionId.substring(0, 8)}...]:`, {
              chunkSize: chunk.length,
              sent,
              buffered: !sent
            });
          }
          
          if (!sent) {
            // buffer output for later flush
            sw.outputBuffer.push({ chunk: redactedChunk, timestamp: Date.now() });
            if (sw.outputBuffer.length > 1000) {
              sw.outputBuffer = sw.outputBuffer.slice(-800);
            }
          }
        });

        pty.onExit((e: any) => {
          // notify last known client (if any)
          const targetClient = sw.clientId || clientId;
          if (targetClient) {
            this.sendToClient(targetClient, { type: 'terminal', data: { op: 'exit', sessionId, code: e?.exitCode } });
          }
          try { this.sessions.delete(sessionId); } catch {}
        });
        this.reply(clientId, id, { op: 'create', ok: true, sessionId, cwd, cols, rows, event: 'ready', persistent, availableProviders: this.credentialManager.getAvailableAIProviders() });
        return;
      } catch (err) {
        // Fall through to pipe-based shell if PTY spawn fails
        if (this.debug) {
          console.warn('[TerminalService] node-pty spawn failed; falling back', err);
        }
      }
    }

    // Pipe-based fallback (no true PTY). Provides a persistent shell for basic commands.
    try {
      const { spawn } = await import('child_process');
      const args = process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : ['-i'];
      const child = spawn(shell, args, { cwd, env: enhancedEnv });

      // Minimal wrapper to look like a PTY for downstream handlers
      const wrapper = {
        write: (d: string) => { try { child.stdin?.write(d); } catch {} },
        kill: () => { try { child.kill(); } catch {} },
        resize: (_c: number, _r: number) => { /* not supported */ },
        child,
      } as any;

      // Wire stdout/stderr
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        sw.lastActivity = Date.now();
        const text = this.redact(chunk);
        const sent = sw.clientId ? this.sendToClient(sw.clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: text } }) : false;
        if (!sent) {
          sw.outputBuffer.push({ chunk: text, timestamp: Date.now() });
          if (sw.outputBuffer.length > 1000) sw.outputBuffer = sw.outputBuffer.slice(-800);
        }
      });
      child.stderr?.on('data', (chunk: string) => {
        sw.lastActivity = Date.now();
        const text = this.redact(chunk);
        const sent = sw.clientId ? this.sendToClient(sw.clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: text } }) : false;
        if (!sent) {
          sw.outputBuffer.push({ chunk: text, timestamp: Date.now() });
          if (sw.outputBuffer.length > 1000) sw.outputBuffer = sw.outputBuffer.slice(-800);
        }
      });
      child.on('close', (code: number) => {
        const targetClient = sw.clientId || clientId;
        if (targetClient) {
          this.sendToClient(targetClient, { type: 'terminal', data: { op: 'exit', sessionId, code } });
        }
        try { this.sessions.delete(sessionId); } catch {}
      });

      const sw: SessionWrapper = {
        sessionId,
        pty: wrapper,
        clientId,
        persistent,
        isFallback: true,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: [],
      };
      this.sessions.set(sessionId, sw);
      this.reply(clientId, id, { op: 'create', ok: true, sessionId, cwd, cols, rows, event: 'ready', note: 'pty-fallback', persistent, availableProviders: this.credentialManager.getAvailableAIProviders() });
      // Send a short banner so users know capabilities
      const banner = `[PTY fallback] Interactive shell without full TTY. Some apps may not work.\r\n`;
      this.sendToClient(clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: banner } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Preserve previous error surface for UI if everything failed
      const reason = nodePtyLoadError ? ` (load: ${nodePtyLoadError})` : '';
      this.reply(clientId, id, { op: 'create', ok: false, error: `node-pty not available; fallback failed: ${msg}${reason}` });
    }
  }

