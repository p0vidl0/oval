import { type ComposeProject, loadProjectEnv } from "./env-files";
import { renderProjectEnv } from "./render-env";

/** Env for `next build` on the host when root `.env` is absent (optional profile overrides). */
export function envForHostBuild(
  project: ComposeProject = "oval-dev",
): Record<string, string> {
  renderProjectEnv(project);
  const profile = loadProjectEnv(project);
  return {
    ...(profile.DATABASE_URL ? { DATABASE_URL: profile.DATABASE_URL } : {}),
    ...(profile.BETTER_AUTH_SECRET
      ? { BETTER_AUTH_SECRET: profile.BETTER_AUTH_SECRET }
      : {}),
    ...(profile.BETTER_AUTH_URL
      ? { BETTER_AUTH_URL: profile.BETTER_AUTH_URL }
      : {}),
  };
}
