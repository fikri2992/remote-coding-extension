import * as fs from 'fs';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';

/**
 * GitIgnoreFilter loads patterns from a workspace .gitignore (if present)
 * and applies them to relative paths when listing directories.
 * Falls back to sensible defaults for common bulky folders.
 */
export class GitIgnoreFilter {
  private ig: Ignore;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, extraDefaults: string[] = []) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.ig = ignore();

    const defaults = [
      'node_modules/',
      '.git/',
      '.hg/',
      '.svn/',
      '.DS_Store',
      'out/',
      'dist/',
      'build/'
    ];

    const patterns: string[] = [...defaults, ...extraDefaults];

    // Load .gitignore at workspace root if present
    try {
      const giPath = path.join(this.workspaceRoot, '.gitignore');
      if (fs.existsSync(giPath)) {
        const content = fs.readFileSync(giPath, 'utf8');
        // Support CRLF and LF
        const lines = content.split(/\r?\n/).filter(Boolean);
        patterns.push(...lines);
      }
    } catch {}

    this.ig.add(patterns);
  }

  /**
   * Returns true if the given absolute path should be ignored.
   * Paths are evaluated relative to workspaceRoot using forward slashes.
   */
  public isIgnored(absPath: string, isDirectory: boolean): boolean {
    const rel = path.relative(this.workspaceRoot, path.resolve(absPath)).replace(/\\/g, '/');
    if (!rel || rel === '.') return false; // never ignore workspace root itself
    const candidate = isDirectory ? (rel.endsWith('/') ? rel : rel + '/') : rel;
    return this.ig.ignores(candidate);
  }
}

