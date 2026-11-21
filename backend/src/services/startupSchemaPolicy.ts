export interface StartupSchemaEnvironment {
  NODE_ENV?: string;
  ALLOW_RUNTIME_SCHEMA_BOOTSTRAP?: string;
}

export function shouldRunRuntimeSchemaBootstrap(environment: StartupSchemaEnvironment): boolean {
  const requested = environment.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP === 'true';
  if (requested && environment.NODE_ENV === 'production') {
    throw new Error('Runtime schema bootstrap is prohibited in production. Apply manifested migrations through the controlled release command.');
  }
  return requested;
}

export async function runRuntimeSchemaBootstrap(
  environment: StartupSchemaEnvironment,
  bootstraps: ReadonlyArray<() => Promise<void>>,
): Promise<boolean> {
  if (!shouldRunRuntimeSchemaBootstrap(environment)) return false;
  for (const bootstrap of bootstraps) await bootstrap();
  return true;
}
