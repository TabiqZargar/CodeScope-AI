import { SCHEMA_VERSION } from "./types";
import type { SessionResult } from "./types";
import { validateSession } from "./validation";

/**
 * Schema migration registry.
 *
 * When the session shape changes, bump {@link SCHEMA_VERSION} and register a
 * migration `fromVersion → nextVersion`. Stored/imported sessions below the
 * current version are migrated on load, so old files never break and the
 * serialized format never needs to be forward-compatible.
 *
 * Only v1 exists today, so the registry is intentionally empty — the hooks and
 * the identity path are exercised by tests.
 */

type MigrateFn = (raw: Record<string, unknown>) => Record<string, unknown>;

const migrations = new Map<number, MigrateFn>();

/** Register a migration that upgrades a session from `fromVersion` to `fromVersion + 1`. */
export function registerMigration(fromVersion: number, migrate: MigrateFn): void {
  migrations.set(fromVersion, migrate);
}

/** Register a migration, replacing any existing one. */
export function setMigration(fromVersion: number, migrate: MigrateFn): void {
  migrations.set(fromVersion, migrate);
}

/** The versions a migration is available for (ascending). */
export function migrationVersions(): readonly number[] {
  return [...migrations.keys()].sort((a, b) => a - b);
}

/** True when a migration for `fromVersion` exists. */
export function hasMigration(fromVersion: number): boolean {
  return migrations.has(fromVersion);
}

/**
 * Migrate raw input up to the current schema version. `ok:false` with
 * `unsupported-version` when the input is newer than the app understands.
 * Structural checks (is it even an object, does it carry a version) run here;
 * deep validation happens after migration.
 */
export function migrateSession(input: unknown): SessionResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: { code: "not-object", message: "A session must be a JSON object." } };
  }
  const raw = input as Record<string, unknown>;
  const schemaVersion = raw.schemaVersion;

  if (schemaVersion === undefined) {
    return { ok: false, error: { code: "missing-schema-version", message: "The session is missing its schema version." } };
  }
  if (typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion)) {
    return { ok: false, error: { code: "invalid-schema-version", message: "The session schema version must be a number." } };
  }
  if (schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: "unsupported-version",
        message: `This session uses schema v${schemaVersion}; only v${SCHEMA_VERSION} is supported.`,
      },
    };
  }

  let current: Record<string, unknown> = raw;
  for (let version = schemaVersion; version < SCHEMA_VERSION; version += 1) {
    const migrate = migrations.get(version);
    if (!migrate) {
      return {
        ok: false,
        error: {
          code: "unsupported-version",
          message: `No migration exists for schema v${version}.`,
        },
      };
    }
    current = migrate(current);
    current = { ...current, schemaVersion: version + 1 };
  }

  return validateSession(current);
}
