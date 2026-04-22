import assert from 'node:assert/strict';
import test from 'node:test';

import { getDashboardHtml } from '../../src/webview/getHtml.ts';

test('getDashboardHtml injects the asset URIs, nonce, and initial state payload', () => {
  const html = getDashboardHtml({
    cspSource: 'vscode-webview://view',
    cssUri: 'vscode-webview://view/media/dashboard.css',
    jsUri: 'vscode-webview://view/media/dashboard.js',
    nonce: 'nonce-123',
    initialState: {
      snapshot: {
        target: 'local',
        host: {
          hostname: 'dev-box',
          platform: 'Windows',
          arch: 'x64',
          uptimeSeconds: 10,
          updatedAt: '2026-04-18T06:00:00.000Z'
        }
      }
    }
  });

  assert.match(html, /dashboard\.css/);
  assert.match(html, /dashboard\.js/);
  assert.match(html, /nonce-123/);
  assert.match(html, /application\/json/);
  assert.match(html, /dev-box/);
});
