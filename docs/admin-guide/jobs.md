---
title: Jobs
nav_order: 11
permalink: /admin-guide/jobs
parent: Admin guide
---

# Jobs

Background work (scheduled jobs, large security reindexes, jobs started through the API) is stored in the `job` table, which is used as a queue. Workers take jobs from it; any number of workers can run against the same database.

## How the queue works

- **Claiming:** a worker takes the oldest queued job with `SELECT ... FOR UPDATE SKIP LOCKED`, so two workers never take the same job and neither waits for the other.
- **Leases:** the worker that claimed a job holds a lease on it (`locked_by`, `locked_until`) and renews it every third of the lease while the job runs. If the worker crashes or is killed, the lease runs out and the next worker that looks at the queue queues the job again.
- **Retries:** a job that throws is retried with exponential backoff (`backoff`, `2 × backoff`, `4 × backoff`, ... up to `maxBackoff` seconds) until it has used `maxAttempts` attempts. Then its status is `failed` and its `result` holds the error. A job is only `completed` when it succeeded.
- **One transaction:** a job runs in its own transaction, and it is marked `completed` in the same transaction. A worker that lost its lease (because it stalled for longer than the lease) rolls its work back instead of completing a job another worker now owns.
- **Idempotency:** jobs can carry a unique key (`jobs.add(..., { key })`). A second job with the same key is not added. The scheduler uses this to start a periodic job once per time slot.
- **Abort:** `POST /@jobs/{id}/abort` marks the job `aborted` in the database. The worker running it notices at its next heartbeat, stops a child process if there is one, and rolls the job's transaction back.

## Statuses

| Status      | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `created`   | Queued, or waiting for its next attempt after a failure    |
| `started`   | Claimed by a worker                                        |
| `completed` | Finished successfully; `result` holds the outcome          |
| `failed`    | Failed in its last attempt; `result.error` holds the error |
| `aborted`   | Aborted through the API                                    |

## Configuration

Settings go under `jobs` in `config.ts`; some can be set with environment variables.

| Key            | Environment variable | Default                   | Description                                                                                                     |
| -------------- | -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `isolation`    | `JOBS_ISOLATION`     | `inline`                  | `inline` runs jobs in the worker process; `process` forks a child process per job (more isolation, slower)      |
| `lease`        | `JOBS_LEASE`         | `60`                      | Seconds a worker holds a job without renewing the lease; after a crash a job is retried after at most this long |
| `maxAttempts`  | `JOBS_MAX_ATTEMPTS`  | `3`                       | Attempts before a job is marked `failed`                                                                        |
| `backoff`      |                      | `10`                      | Seconds before the first retry; doubles with every attempt                                                      |
| `maxBackoff`   |                      | `3600`                    | Maximum seconds between attempts                                                                                |
| `pollInterval` | `JOBS_POLL_INTERVAL` | `2`                       | Seconds between looks at the queue when it is empty                                                             |
| `apiPath`      | `JOBS_API_PATH`      | `http://localhost:{port}` | Base URL used in the results of jobs that call an API method                                                    |
