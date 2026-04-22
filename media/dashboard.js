(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('dashboard-root');
  const stateElement = document.getElementById('server-monitor-state');
  let currentState = readInitialState(stateElement);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;
    if (action === 'refresh') {
      vscode.postMessage({ type: 'refresh' });
      return;
    }

    if (action === 'kill-process') {
      const pid = Number(target.dataset.pid);
      vscode.postMessage({ type: 'killProcess', pid });
    }
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.type !== 'snapshot') {
      return;
    }

    currentState = { snapshot: message.snapshot };
    render();
  });

  render();
  vscode.postMessage({ type: 'ready' });

  function render() {
    if (!root) {
      return;
    }

    root.textContent = '';
    const snapshot = currentState.snapshot;
    if (!snapshot) {
      root.appendChild(renderMessage('No snapshot yet. Use refresh to load current data.'));
      return;
    }

    root.appendChild(renderOverview(snapshot));
    root.appendChild(renderProcesses(snapshot));
  }

  function renderOverview(snapshot) {
    const panel = createElement('section', 'panel');
    const grid = createElement('div', 'stats-grid');
    grid.appendChild(renderStat('Target', titleCase(snapshot.target)));
    grid.appendChild(renderStat('Host', snapshot.host.hostname || 'Unknown'));
    grid.appendChild(renderStat('CPU', describeCpu(snapshot.cpu)));
    grid.appendChild(renderStat('Memory', describeMemory(snapshot.memory)));
    grid.appendChild(renderStat('Platform', [snapshot.host.platform, snapshot.host.arch].filter(Boolean).join(' / ') || 'Unknown'));
    grid.appendChild(renderStat('Updated', formatDate(snapshot.host.updatedAt)));
    panel.appendChild(grid);
    return panel;
  }

  function renderProcesses(snapshot) {
    const panel = createElement('section', 'process-list');
    panel.appendChild(renderHeading('Processes'));

    if (!snapshot.processes || snapshot.processes.status !== 'ok' || snapshot.processes.data.length === 0) {
      panel.appendChild(renderMessage('No process data available.'));
      return panel;
    }

    const processes = snapshot.processes.data.slice().sort((left, right) => right.cpuPercent - left.cpuPercent).slice(0, 5);
    for (const process of processes) {
      const row = createElement('div', 'process-row');
      const copy = createElement('div');
      copy.appendChild(renderHeading(`${process.name} (${process.pid})`, 'h3'));
      copy.appendChild(renderMessage(`${formatPercent(process.cpuPercent)} CPU - ${formatPercent(process.memoryPercent)} MEM`, true));
      row.appendChild(copy);

      if (snapshot.capabilities && snapshot.capabilities.canKillProcess) {
        const button = createElement('button', 'process-button');
        button.type = 'button';
        button.dataset.action = 'kill-process';
        button.dataset.pid = String(process.pid);
        button.textContent = 'Kill';
        row.appendChild(button);
      }

      panel.appendChild(row);
    }

    return panel;
  }

  function renderStat(label, value) {
    const wrapper = createElement('div');
    const statLabel = createElement('span', 'stat-label');
    statLabel.textContent = label;
    const statValue = createElement('strong', 'stat-value');
    statValue.textContent = value;
    wrapper.appendChild(statLabel);
    wrapper.appendChild(statValue);
    return wrapper;
  }

  function renderHeading(text, tagName) {
    const heading = document.createElement(tagName || 'h2');
    heading.textContent = text;
    return heading;
  }

  function renderMessage(text, muted) {
    const message = createElement('p', muted ? 'muted' : '');
    message.textContent = text;
    return message;
  }

  function createElement(tagName, className) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }

    return element;
  }

  function describeCpu(cpu) {
    if (!cpu || cpu.status !== 'ok') {
      return 'Unavailable';
    }

    return `${formatPercent(cpu.data.usagePercent)} - ${cpu.data.cores} cores`;
  }

  function describeMemory(memory) {
    if (!memory || memory.status !== 'ok') {
      return 'Unavailable';
    }

    return `${formatGigabytes(memory.data.usedBytes)} / ${formatGigabytes(memory.data.totalBytes)}`;
  }

  function formatGigabytes(bytes) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  function formatPercent(value) {
    return `${Number(value).toFixed(1)}%`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  }

  function titleCase(value) {
    return String(value || '').replace(/^./, (character) => character.toUpperCase());
  }

  function readInitialState(element) {
    if (!element) {
      return {};
    }

    try {
      return JSON.parse(element.textContent || '{}');
    } catch {
      return {};
    }
  }
})();
