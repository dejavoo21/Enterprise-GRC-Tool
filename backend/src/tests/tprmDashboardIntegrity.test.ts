import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const page = () => readFileSync(resolve(process.cwd(), '../frontend/src/pages/TPRMDashboard.tsx'), 'utf8');

test('TPRM dashboard rejects stale workspace aggregate responses', () => {
  const source = page();
  assert.match(source, /const \{ workspaceId \} = useWorkspace\(\)/);
  assert.match(source, /const requestSequence = useRef\(0\)/);
  assert.match(source, /const sequence = \+\+requestSequence\.current/);
  assert.match(source, /requestedWorkspace !== workspaceRef\.current/);
  assert.match(source, /setSummary\(null\)/);
  assert.match(source, /return \(\) => \{ requestSequence\.current \+= 1; \}/);
  assert.match(source, /\[workspaceId\]/);
});

test('TPRM dashboard navigation metrics use keyboard-accessible controls', () => {
  const source = page();
  assert.match(source, /<button\s+type="button"/);
  assert.match(source, /aria-label=\{`\$\{label\}: \$\{value\}`\}/);
  assert.doesNotMatch(source, /cursor: onClick \? 'pointer'/);
});
