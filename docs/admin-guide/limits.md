---
title: Limits
nav_order: 9
permalink: /admin-guide/limits
parent: Admin guide
---

# Limits

Nick provides configurable limits for request body sizes and request rate limiting to protect against abuse and ensure stability.

## Request Body Limits

Controls the maximum size of incoming request payloads.

### Configuration

```typescript
export const config = {
  requestLimit: {
    api: '1mb', // Global JSON body limit
    files: '10mb', // Content create/update payload limit
    chunk: '1mb', // File download chunk size
  },
};
```

| Key     | Default  | Description                                                                                                               |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `api`   | `'1mb'`  | Maximum body size of JSON requests, except creating and updating content                                                  |
| `files` | `'10mb'` | Maximum body size for content creation and update (POST/PATCH), with uploaded files as base64 JSON or multipart/form-data |
| `chunk` | `'1mb'`  | Chunk size when streaming file downloads via range requests                                                               |

Values use human-readable size strings (e.g. `'1mb'`, `'500kb'`, `'2gb'`).

Requests exceeding the `api` or `files` limit receive a `413 Payload Too Large` response.

## Rate Limits

Controls how many requests a client can make within a 15-minute sliding window. Excess requests receive a `429 Too Many Requests` response.

Rate limiting applies to specific endpoints. It is not applied globally.

### Configuration

```typescript
export const config = {
  rateLimit: {
    api: 100, // General API requests per 15 minutes
    auth: 5, // Authentication requests per 15 minutes
    trustProxy: 1, // Number of proxy hops to trust
  },
};
```

| Key          | Default  | Environment Variable | Description                                         |
| ------------ | -------- | -------------------- | --------------------------------------------------- |
| `api`        | `100`    | `API_RATE_LIMIT`     | Max requests per 15-minute window on API routes     |
| `auth`       | `5`      | `AUTH_RATE_LIMIT`    | Max requests per 15-minute window on auth routes    |
| `trustProxy` | `1`      | `TRUST_PROXY`        | Express trust proxy setting (number of hops)        |
| `store`      | `memory` | `RATE_LIMIT_STORE`   | Where the counters are kept: `memory` or `postgres` |

### Where Rate Limits Apply

**Auth limiter** (5 requests per 15 minutes):

| Endpoint        | Method | Description   |
| --------------- | ------ | ------------- |
| `/@login`       | POST   | User login    |
| `/@login-renew` | POST   | Token renewal |

**API limiter** (100 requests per 15 minutes):

| Endpoint                        | Method | Description                 |
| ------------------------------- | ------ | --------------------------- |
| `/@search`                      | GET    | Search                      |
| `/@querystring-search`          | POST   | Advanced search             |
| `/@users`                       | GET    | List users                  |
| `/@groups`                      | GET    | List groups                 |
| `/@principals`                  | GET    | List principals             |
| `/@controlpanels/content-rules` | GET    | Content rules control panel |
| `/@content-rules`               | GET    | List content rules          |
| `/@sharing`                     | GET    | Sharing settings            |
| `/@email-notification`          | POST   | Email notifications         |
| `/@schemaform-data`             | POST   | Form submissions            |
| `/@jobs`                        | GET    | List jobs                   |
| `/@scheduled-job-actions`       | GET    | Scheduled job actions       |
| `/@scheduled-jobs/:id`          | GET    | Get scheduled job           |
| `/@scheduled-jobs`              | GET    | List scheduled jobs         |
| `/@recyclebin`                  | GET    | List recycle bin items      |

### Several API processes

With the default `memory` store, every process counts its own requests, so with N API replicas behind a load balancer a client can make up to N times the limit. Set `store` to `postgres` (or `RATE_LIMIT_STORE=postgres`) to keep the counters in the `rate_limit` table, shared by all processes. That costs one small write per rate-limited request.

### Trust Proxy

The `trustProxy` setting is required for rate limiting to correctly identify client IPs when Nick runs behind a reverse proxy (Nginx, Caddy, load balancer, etc.). Set it to the number of proxy hops in front of your application.

### Environment Variables

Rate limits can be overridden via environment variables without modifying `config.ts`:

```bash
# Bump limits for testing
export API_RATE_LIMIT=1000
export AUTH_RATE_LIMIT=1000
```

This is used in CI and test environments to prevent false failures.
