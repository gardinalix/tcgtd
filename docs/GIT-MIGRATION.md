# Migration to gardinalix/tcgtd

The migration target is [https://github.com/gardinalix/tcgtd](https://github.com/gardinalix/tcgtd). This is a repository migration; the existing Sites deployment and `tcgtd.com.br` remain in place.

## Repository scope

Preserve the existing Git history and carry the current local project state into the target repository. Include all versioned files and the relevant, nonignored local changes, including new public card images, thumbnails and competitive tournament payloads. Review the final file list and diff before committing and pushing.

The repository includes:

- React application source and the retained legacy web application.
- Local Node authentication server and hosted Worker source.
- Public browser datasets, cached public images and asset rights metadata.
- Competitive source registries, raw evidence, normalized records and generated projections.
- Data collectors, build scripts, schema migrations, tests, import templates and documentation.
- Package lockfile, GitHub workflows and existing Sites hosting metadata.

Keep `.openai/hosting.json` attached to the existing Sites project during migration. It declares the `DB` D1 binding and is copied into the build output. Moving the Git remote does not move or recreate that project or database.

## Local and private files

Honor `.gitignore`. Do not commit `.env`, provider credentials, local runtime files, dependencies, compiled builds, scratch files, backups or operator exports. General data caches outside `data/competitive/`, including `data/gundam.db`, stay local.

The SQLite database can contain local account and session state in addition to public card data. Preserve it on the workstation or in an appropriate private backup; do not publish it to Git. General official/price snapshots and CSV caches can be regenerated with the refresh tools. A fresh clone builds from the committed public frontend payload and competitive datastore without those caches.

Do not regenerate public data from missing local caches merely to prepare the migration. The public payload and current assets should be preserved together.

## Remotes and history

The original repository remote is a Sites-managed repository under `git.chatgpt-team.site`. Preserve it as `sites-source`. Configure `origin` as `https://github.com/gardinalix/tcgtd.git` once the target push succeeds and has been verified.

Inspect the destination before pushing. Preserve existing destination work and avoid force-pushing over an existing branch. The migration should retain the source commit ancestry while adding the reviewed local changes and migration documentation. If the destination already contains independent work, reconcile that history explicitly rather than discarding it.

After migration, inspect:

```bash
git remote -v
git status --short
git log --oneline -5
```

Confirm that `origin` points to the target, `sites-source` still identifies the source repository, and the target branch contains the migration commit and its source ancestry. Verify a fresh clone before relying on the new repository as the main development checkout.

## Local validation

Use Node.js 24 and the committed npm lockfile:

```bash
npm ci
npm run data:validate
npm test
npm run build
```

The build emits static files to `dist/client/`, copies Worker source to `dist/server/`, and retains hosting metadata in `dist/.openai/hosting.json`. Build steps may rewrite generated competitive projections, `web/home-data.json` and the rights manifest; review any resulting diff.

Smoke-test the local frontend and affected routes, including direct navigation, public JSON loading and representative card images. If authentication or backend behavior changes, configure a private local `.env`, run `npm run migrate:auth` and `npm run auth`, and verify the relevant APIs through Vite's development proxy. Migration alone does not require new live account or data writes.

`.github/workflows/validate.yml` runs dependency installation, normalized data validation, Node tests and the build on pushes and pull requests to `main`. It has read-only repository permissions and no deployment step.

The separate GitHub tournament updater is paused during migration: its schedule is removed and its job is explicitly disabled. Its Python payload builder requires the ignored advisor/card/price snapshots or local SQLite database. Without those inputs, a fresh runner can overwrite the committed card catalog, rules and prices with empty values. Re-enable the job and schedule only after implementing and validating a complete fresh-clone update path that preserves the existing public payload on missing or failed inputs. Local update commands are unchanged.

## Hosted state and publication

These items are outside the Git transfer:

- D1 data, pilot identities, feedback, subscription entitlements and community schedule records.
- Hosted secrets and environment variables for OAuth, remote AI and optional integrations.
- Domain/DNS records, access policy, hosting ownership and platform identity integration.
- OAuth provider callback registrations and analytics configuration.
- Collections and decks stored in individual browsers.

The Worker currently uses Sites-provided static asset and identity integration. GitHub hosting or another Worker deployment requires separate configuration and validation; a Git push does not make those services portable automatically.

Follow [AGENTS.md](../AGENTS.md): implement and validate locally first, then obtain explicit approval before a production version, deployment or live-only configuration/data change. An instruction to migrate the repository does not authorize live publication. Publish only the locally validated version after approval, wait for deployment completion, and verify the production domain and affected routes. Report publication and live verification separately.
