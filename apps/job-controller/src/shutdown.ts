/**
 * Shutdown handling.
 *
 * A graceful stop waits for in-flight work, and in-flight work here is a multi-GB download or a
 * parser run — minutes, sometimes longer. Waiting silently for that looks exactly like a hang, so:
 *
 *   1st Ctrl-C / SIGTERM   stop taking new work, finish what is running, and say how to skip that
 *   2nd Ctrl-C             force quit now: kill the parser processes and exit
 *   after SHUTDOWN_TIMEOUT_MS   force quit anyway (default 30s; 0 disables)
 *
 * Forcing is safe by design: a job that does not finish stays in `{queue}:inflight` under this
 * node's id, stops being heartbeated, and the reaper hands it to another node (or to this one on
 * restart). Nothing is lost — the work is redone.
 */
import { killRunningParsers, runningParsers } from "./queue/tic/parser";

export interface ShutdownOptions {
  /** Called on the first signal, to wake poll loops out of their sleep. */
  onStop: () => void;
  /** Force-quit after this long in the graceful phase. 0 = wait forever. */
  timeoutMs: number;
  /** Test seam. */
  exit?: (code: number) => never;
}

const SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

/** Kill child parsers and leave immediately. */
export function forceQuit(reason: string, exit: (code: number) => never = process.exit): never {
  const parsers = killRunningParsers("SIGKILL");
  console.warn(
    `[job-controller] force quit (${reason})` +
      (parsers > 0 ? ` — killed ${parsers} parser process(es)` : "") +
      "; in-flight jobs stay queued and will be reassigned",
  );
  return exit(130);
}

/**
 * Installs the handlers. Returns `running()`, which the poll loops check: false once a stop has
 * been requested.
 */
export function installShutdown(opts: ShutdownOptions): () => boolean {
  const exit = opts.exit ?? process.exit;
  let running = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onSignal = (sig: NodeJS.Signals) => {
    if (!running) {
      // Second signal while already draining. `return` matters: forceQuit is typed `never`, but
      // an injected exit (tests) returns, and falling through would re-arm the timer.
      if (timer) clearTimeout(timer);
      return forceQuit(`second ${sig}`, exit);
    }
    running = false;
    const parsers = runningParsers();
    console.log(
      `[job-controller] ${sig} — finishing in-flight work` +
        (parsers > 0 ? ` (${parsers} parser process(es) running)` : "") +
        `. Press Ctrl-C again to force quit` +
        (opts.timeoutMs > 0 ? `, or wait ${Math.round(opts.timeoutMs / 1000)}s` : "") +
        ".",
    );
    opts.onStop();
    if (opts.timeoutMs > 0) {
      timer = setTimeout(() => forceQuit(`did not finish within ${opts.timeoutMs}ms`, exit), opts.timeoutMs);
      // Do not hold the event loop open just for the force-quit timer.
      timer.unref?.();
    }
  };

  for (const sig of SIGNALS) process.on(sig, () => onSignal(sig));
  return () => running;
}
