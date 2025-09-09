import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let level: LogLevel = (process.env.KIRO_LOG_LEVEL as LogLevel) || 'info';

export function setLogLevel(l: LogLevel) {
  level = l;
}

function allow(target: LogLevel): boolean {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(target) >= order.indexOf(level);
}

export const log = {
  debug: (...args: any[]) => { if (allow('debug')) console.log(chalk.gray('[debug]'), ...args); },
  info:  (...args: any[]) => { if (allow('info'))  console.log(chalk.cyan('[info ]'), ...args); },
  warn:  (...args: any[]) => { if (allow('warn'))  console.warn(chalk.yellow('[warn ]'), ...args); },
  error: (...args: any[]) => { if (allow('error')) console.error(chalk.red('[error]'), ...args); },
};

export default log;

