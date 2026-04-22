export interface DashboardState {
  snapshot?: {
    target: string;
    host: {
      hostname: string;
      platform: string;
      arch: string;
      uptimeSeconds: number;
      updatedAt: string;
    };
  };
}

export interface DashboardHtmlOptions {
  cspSource: string;
  cssUri: string;
  jsUri: string;
  nonce: string;
  initialState: DashboardState;
}

export function getDashboardHtml(options: DashboardHtmlOptions): string {
  const stateJson = escapeHtml(JSON.stringify(options.initialState));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${options.cspSource} https: data:; style-src ${options.cspSource}; script-src 'nonce-${options.nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${options.cssUri}" />
  <title>Server Monitor</title>
</head>
<body>
  <div class="dashboard-shell">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Server Monitor</p>
        <h1 class="title">Overview</h1>
      </div>
      <button class="refresh-button" type="button" data-action="refresh">Refresh</button>
    </header>
    <div id="dashboard-root" class="dashboard-root"></div>
  </div>
  <script id="server-monitor-state" type="application/json">${stateJson}</script>
  <script nonce="${options.nonce}" src="${options.jsUri}"></script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
