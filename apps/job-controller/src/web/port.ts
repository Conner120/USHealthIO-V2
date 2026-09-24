/**
 * Port selection for the dashboard.
 *
 * `WEB_PORT` set   -> use it, fail loudly if taken, and do NOT open a browser (the operator chose
 *                     the port, so this is probably a server or a container).
 * `WEB_PORT` unset -> ask the OS for a free port (bind :0) and open the page once, for the
 *                     someone-ran-it-on-their-laptop case.
 */
export interface PortChoice {
  /** Port to bind. 0 means "let the OS pick". */
  port: number;
  /** Open a browser once the server is listening. */
  autoOpen: boolean;
}

export interface PortEnv {
  WEB_PORT?: string;
  WEB_OPEN?: string;
}

export function choosePort(env: PortEnv = process.env as PortEnv): PortChoice {
  const raw = env.WEB_PORT?.trim();
  const explicit = raw !== undefined && raw !== "";
  const port = explicit ? Number(raw) : 0;
  if (explicit && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error(`invalid WEB_PORT: ${raw}`);
  }
  // WEB_OPEN overrides the default either way ("1"/"true" to force, "0"/"false" to suppress).
  const override = env.WEB_OPEN?.trim().toLowerCase();
  const autoOpen = override === undefined || override === ""
    ? !explicit
    : ["1", "true", "yes"].includes(override);
  return { port, autoOpen };
}

/** Browser-open command for this platform. */
export function openCommand(url: string, platform = process.platform): string[] | null {
  if (platform === "darwin") return ["open", url];
  if (platform === "win32") return ["cmd", "/c", "start", "", url];
  if (platform === "linux") return ["xdg-open", url];
  return null;
}

/** Best-effort: a failure to open a browser must never take the node down. */
export function openBrowser(url: string): void {
  const cmd = openCommand(url);
  if (!cmd) return;
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).unref();
  } catch (e) {
    console.warn(`[web] could not open a browser for ${url}:`, e);
  }
}
