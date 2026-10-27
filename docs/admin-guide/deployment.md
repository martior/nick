---
title: Deployment
nav_order: 12
permalink: /admin-guide/deployment
parent: Admin guide
---

# Deployment

Nick has one entrypoint, `nick`, which runs any combination of three modules:

| Module    | What it does                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `migrate` | Runs the knex migrations of core and of every package of the profiles (in dependency order), installs profiles that are not installed yet and runs the upgrade steps of installed profiles. Exits non-zero on any error. |
| `api`     | Serves the REST API on `port` (`PORT`), on every interface or only on `host` (`BIND_HOST`), for example `127.0.0.1` behind a reverse proxy on the same machine.                                                          |
| `worker`  | Runs queued [jobs](/admin-guide/jobs) and schedules periodic jobs.                                                                                                                                                       |

```bash
nick                              # all modules: migrate, then api and worker
nick --modules=migrate            # migrate and exit (0 on success, 1 on failure)
nick --modules=api                # API only
nick --modules=worker             # worker only
nick --modules=api,worker         # API and worker in one process
NICK_MODULES=worker nick          # the same with an environment variable
nick --modules=migrate --check-schema   # also compare the schema with src/migrations/schema.snapshot.txt
```

In a checkout, run it with `pnpm nick --modules=...`. `pnpm start` runs the API and the worker (with nodemon, for development); `pnpm migrate` and `pnpm seed` still work as before.

`migrate` always runs first. When it fails, the other modules do not start and the process exits with code 1. Only one process migrates at a time (a Postgres advisory lock), so several replicas started with `migrate` wait for each other instead of running the same migrations twice.

## Docker image

The `Dockerfile` builds a production image: production dependencies only (no nodemon), running as the unprivileged `node` user, with `nick` as its entrypoint and a health check on `@health`.

```bash
docker build -t nick .

# Migrate (exits non-zero on errors), then start the API and a worker
docker run --rm -e DB_HOST=db -e DB_PASSWORD=... -e SECRET=... nick --modules=migrate
docker run -d -p 8080:8080 -e NICK_MODULES=api -e DB_HOST=db -e DB_PASSWORD=... -e SECRET=... nick
docker run -d -e NICK_MODULES=worker -e DB_HOST=db -e DB_PASSWORD=... -e SECRET=... nick
```

- **Configuration:** environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET`, `PORT`, `BIND_HOST`, `ALLOWED_ORIGINS`, `API_RATE_LIMIT`, `JOBS_*`, `S3_*`, ...) or a `config.ts` mounted at `/app/config.ts`. Leave `BIND_HOST` unset in a container, Nick has to listen on the container's interface to be reachable through the published port. The image runs with `NODE_ENV=production`, so `SECRET` and `DB_PASSWORD` are required. `PROFILES` lists the profiles to install, comma separated (for example `PROFILES=@plone/nick:core,@plone/nick:default`); without it and without a `config.ts`, the `@plone/nick:default` profile is installed: the demo site, with an `admin` user whose password is `admin`. Set `PROFILES` to your own profiles for a real site, or change the password right after the first start. Profiles of your own can be mounted under `/app/src/profiles/<name>` and listed in `config.ts`, or added in an image built `FROM` this one. Add-ons from the Nick repository can be built in with `--build-arg ADDONS="packages/nick-example-addon"`; projects with add-ons from npm build an image of their own project.
- **Modules:** pass `--modules=...` as the command, or set `NICK_MODULES`. Set `NICK_MODULES` when you split the modules: the health check passes without HTTP for processes that do not run the API.
- **Blobs:** the default `file` storage writes to `/app/var/blobstorage` inside the container. Mount a volume there, or use `db` or [S3-compatible storage](/admin-guide/blobs) when you run more than one API replica.
- **TypeScript:** Nick runs from its TypeScript sources with the `tsx` loader (`node --import tsx`). The image compiles the sources once while it is built, so processes start from a warm cache (about 2.5 s to a listening API).

## Small sites: one process

Run `nick` (all modules) as the only process. It migrates on start, serves the API and runs the jobs.

## Larger sites: split the modules

- Run `nick --modules=migrate` once per deployment, before the new version starts (for example as a Kubernetes Job or an init container). Stop the deployment if it fails.
- Run as many `nick --modules=api` replicas behind a load balancer as you need. The API keeps no state in the process that other replicas need: tokens, locks, jobs and job aborts are in the database. Set `RATE_LIMIT_STORE=postgres` so rate limits count across replicas ([Limits](/admin-guide/limits)); `@health` reports on the replica that answers ([Health](/admin-guide/health)). Store blobs in `db` or S3, not on the local disk.
- Run one or more `nick --modules=worker` replicas. Workers share the queue safely; a periodic job runs once per time slot however many workers run.

The processes stop gracefully on `SIGTERM`: the API stops accepting connections and the worker finishes the job it is running.

## Upgrades

`migrate` upgrades installed profiles step by step (`upgrades/<version>/` of each profile). Every step runs in its own transaction, which also stores the step's number as the profile version. When a step fails, its changes are rolled back, the profile stays at the previous step, `migrate` exits with code 1, and the next run starts again at the step that failed. Upgrade steps must therefore finish within one transaction; split large data changes into several steps or into [jobs](/admin-guide/jobs).

`pnpm seed:upgrade` runs the same upgrade steps without the knex migrations.

CI bootstraps the version before each push and then migrates it to the pushed version twice, so a broken or non-repeatable migration or upgrade step fails the build.
