---
permalink: /rest-api/endpoints/roles
parent: Endpoints
---

# Roles

Available roles in a Plone site can be queried by interacting with the `/@roles` endpoint on portal root (requires the `Manage Users` permission):

## List Roles

To retrieve a list of all roles in the portal, call the `/@roles` endpoint with a `GET` request:

```http
{% include_relative examples/roles/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/roles/get.ts %}
```

The server will respond with a list of all roles in the site:

```http
{% include_relative examples/roles/get.res %}
```

The role `title` is the translated role title.

Users without the `Manage Users` permission get a `401 Unauthorized` (anonymous) or `403 Forbidden`:

```http
{% include_relative examples/roles/get_anonymous.res %}
```
