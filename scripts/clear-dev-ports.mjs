import { execFileSync } from 'node:child_process';

const DEFAULT_PORTS = [3000, 3001];
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const force = args.has('--force');
const projectRoot = normalizePath(process.cwd());

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

function run(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return '';
  }
}

function getListeningPidsByPort() {
  if (process.platform === 'win32') {
    const output = run('netstat', ['-ano', '-p', 'tcp']);
    const result = new Map();

    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('TCP')) {
        continue;
      }

      const columns = trimmed.split(/\s+/);
      const [localAddress, state, pid] = [columns[1], columns[3], columns[4]];
      if (state !== 'LISTENING' || !pid) {
        continue;
      }

      for (const port of DEFAULT_PORTS) {
        if (localAddress.endsWith(`:${port}`)) {
          result.set(port, new Set([...(result.get(port) ?? []), Number(pid)]));
        }
      }
    }

    return result;
  }

  const result = new Map();
  for (const port of DEFAULT_PORTS) {
    const output = run('sh', ['-c', `lsof -nP -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true`]);
    const pids = output
      .split(/\s+/)
      .map((pid) => Number(pid))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    if (pids.length > 0) {
      result.set(port, new Set(pids));
    }
  }
  return result;
}

function getCommandLine(pid) {
  return getProcessInfo(pid)?.commandLine ?? '';
}

function getProcessInfo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  if (process.platform === 'win32') {
    const output = run('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if ($p) { $p | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress }`
    ]).trim();

    if (!output) {
      return null;
    }

    try {
      const parsed = JSON.parse(output);
      return {
        pid: Number(parsed.ProcessId),
        parentPid: Number(parsed.ParentProcessId),
        commandLine: parsed.CommandLine ?? ''
      };
    } catch {
      return null;
    }
  }

  const output = run('ps', ['-p', String(pid), '-o', 'pid=', '-o', 'ppid=', '-o', 'command=']).trim();
  if (!output) {
    return null;
  }

  const match = output.match(/^\s*(\d+)\s+(\d+)\s+([\s\S]*)$/);
  if (!match) {
    return null;
  }

  return {
    pid: Number(match[1]),
    parentPid: Number(match[2]),
    commandLine: match[3] ?? ''
  };
}

function isProjectProcess(commandLine) {
  return normalizePath(commandLine).includes(projectRoot);
}

function getProtectedPids() {
  const protectedPids = new Set();
  let cursor = process.pid;

  while (cursor && !protectedPids.has(cursor)) {
    protectedPids.add(cursor);
    const info = getProcessInfo(cursor);
    if (!info?.parentPid || info.parentPid === cursor) {
      break;
    }
    cursor = info.parentPid;
  }

  return protectedPids;
}

function resolveKillTarget(pid, protectedPids) {
  let targetPid = pid;
  let cursor = pid;
  const seen = new Set();

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const info = getProcessInfo(cursor);
    const parentPid = info?.parentPid;

    if (!parentPid || protectedPids.has(parentPid)) {
      break;
    }

    const parentInfo = getProcessInfo(parentPid);
    if (!parentInfo || !isProjectProcess(parentInfo.commandLine)) {
      break;
    }

    targetPid = parentPid;
    cursor = parentPid;
  }

  return targetPid;
}

function killProcessTree(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
}

const occupiedPorts = getListeningPidsByPort();
const blockers = [];
const protectedPids = getProtectedPids();

for (const [port, pids] of occupiedPorts.entries()) {
  for (const pid of pids) {
    if (pid === process.pid) {
      continue;
    }

    const killPid = resolveKillTarget(pid, protectedPids);
    const processCommandLine = getCommandLine(pid);
    const commandLine = getCommandLine(killPid) || processCommandLine;
    const projectProcess = isProjectProcess(processCommandLine) || isProjectProcess(commandLine);
    blockers.push({ port, pid, killPid, commandLine, projectProcess });
  }
}

if (blockers.length === 0) {
  if (checkOnly) {
    console.log('Development ports 3000 and 3001 are free.');
  }
  process.exit(0);
}

for (const blocker of blockers) {
  const killLabel =
    blocker.killPid === blocker.pid ? '' : ` via project parent PID ${blocker.killPid}`;
  const label = `${blocker.port} -> PID ${blocker.pid}${killLabel}`;
  if (checkOnly) {
    console.log(`${label}: ${blocker.commandLine || 'unknown process'}`);
    continue;
  }

  if (!force && !blocker.projectProcess) {
    console.error(`Port ${label} is occupied by a non-project process.`);
    console.error(blocker.commandLine || 'Command line unavailable.');
    console.error('Close it manually or run: npm run dev:force-reset');
    process.exitCode = 1;
    continue;
  }

  killProcessTree(blocker.killPid);
  console.log(`Stopped stale development process on port ${label}.`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
