import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('authentication requests reject synchronous duplicates and freeze reviewed input', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/Login.tsx'), 'utf8');
  const styles = readFileSync(resolve(process.cwd(), '../frontend/src/pages/Login.css'), 'utf8');

  assert.match(page, /const requestLock = useRef\(false\)/);
  assert.equal((page.match(/if \(requestLock\.current\) return;/g) || []).length, 5);
  assert.equal((page.match(/requestLock\.current = true;/g) || []).length, 4);
  assert.equal((page.match(/requestLock\.current = false;/g) || []).length, 4);
  assert.match(page, /disabled=\{isLoading \|\| isPasskeyLoading\} aria-busy=\{isLoading \|\| isPasskeyLoading\}/);
  assert.match(page, /disabled=\{isLoading\} aria-busy=\{isLoading\}/);
  assert.match(styles, /\.loginFormFieldset \{[^}]*display:grid/);
});
