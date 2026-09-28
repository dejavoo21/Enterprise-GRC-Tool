import assert from 'node:assert/strict';
import test from 'node:test';
import { requireDisposableTestDatabaseUrl } from './frameworkAssessmentScopeTestDb.js';

function withTestDatabaseEnvironment(value: string | undefined, callback: () => void) {
  const previousFrameworkUrl = process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL;
  const previousTestUrl = process.env.TEST_DATABASE_URL;
  delete process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  if (value) process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL = value;
  try {
    callback();
  } finally {
    if (previousFrameworkUrl === undefined) delete process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL;
    else process.env.FRAMEWORK_SCOPE_TEST_DATABASE_URL = previousFrameworkUrl;
    if (previousTestUrl === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = previousTestUrl;
  }
}

test('disposable database guard requires an explicit test URL', () => {
  withTestDatabaseEnvironment(undefined, () => {
    assert.throws(() => requireDisposableTestDatabaseUrl(), /is required/);
  });
});

test('disposable database guard rejects production-like database names', () => {
  withTestDatabaseEnvironment('postgres://user:secret@localhost:5432/grc_production', () => {
    assert.throws(() => requireDisposableTestDatabaseUrl(), /Refusing destructive integration-test setup/);
  });
});

test('disposable database guard accepts marked database names without logging credentials', () => {
  const value = 'postgres://user:secret@localhost:5432/grc_scope_test';
  withTestDatabaseEnvironment(value, () => {
    assert.equal(requireDisposableTestDatabaseUrl(), value);
  });
});
