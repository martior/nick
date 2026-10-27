---
title: Deployment
nav_order: 12
permalink: /admin-guide/deployment
parent: Admin guide
---

# Deployment

Nick has one entrypoint, `nick`, which runs any combination of three modules:

| Module    | What it does                                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate` | Runs the knex migrations, installs profiles that are not installed yet and runs the upgrade steps of installed profiles. Exits non-zero on any error. |
| `api`     | Serves the REST API on `port` (`PORT`).                                                                                                               |
| `worker`  | Runs queued [jobs](/admin-guide/jobs) and schedules periodic jobs.                                                                                    |

```bash
nick                              # all modules: migrate, then api and worker
nick --modules=migrate            # migrate and exit (0 on success, 1 on failure)
nick --modules=api                # API only
nick --modules=worker             # worker only
nick --modules=api,worker         # API and worker in one process
NICK_MODULES=worker nick          # the same with an environment variable
```

In a checkout, run it with `pnpm nick --modules=...`. `pnpm start` runs the API and the worker (with nodemon, for development); `pnpm migrate` and `pnpm seed` still work as before.

`migrate` always runs first. When it fails, the other modules do not start and the process exits with code 1. Only one process migrates at a time (a Postgres advisory lock), so several replicas started with `migrate` wait for each other instead of running the same migrations twice.

## Small sites: one process

Run `nick` (all modules) as the only process. It migrates on start, serves the API and runs the jobs.

## Larger sites: split the modules

- Run `nick --modules=migrate` once per deployment, before the new version starts (for example as a Kubernetes Job or an init container). Stop the deployment if it fails.
- Run as many `nick --modules=api` replicas behind a load balancer as you need. The API keeps no state in the process that other replicas need, except what [Limits](/admin-guide/limits) and [Health](/admin-guide/health) describe.
- Run one or more `nick --modules=worker` replicas. Workers share the queue safely; a periodic job runs once per time slot however many workers run.

The processes stop gracefully on `SIGTERM`: the API stops accepting connections and the worker finishes the job it is running.

## Upgrades

`migrate` upgrades installed profiles step by step (`upgrades/<version>/` of each profile). Every step runs in its own transaction, which also stores the step's number as the profile version. When a step fails, its changes are rolled back, the profile stays at the previous step, `migrate` exits with code 1, and the next run starts again at the step that failed. Upgrade steps must therefore finish within one transaction; split large data changes into several steps or into [jobs](/admin-guide/jobs).

`pnpm seed:upgrade` runs the same upgrade steps without the knex migrations.

CI bootstraps the version before each push and then migrates it to the pushed version twice, so a broken or non-repeatable migration or upgrade step fails the build.
