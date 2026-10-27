---
permalink: /rest-api/endpoints/querystring
parent: Endpoints
---

# Querystring

The `@querystring` endpoint returns the querystring config.

Available options for the querystring can be queried by interacting with the `/@querystring` endpoint on portal root:

## Querystring Config

To retrieve all querystring options in the portal, call the `/@querystring` endpoint with a `GET` request:

```http
{% include_relative examples/querystring/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/querystring/get.ts %}
```

The server will respond with all querystring options in the portal. The operations are named like the `plone.app.querystring` operations Volto expects, the values of the `portal_type` and `review_state` vocabularies are included and indexes which can only be used for sorting (like `sortable_title` and `getObjPositionInParent`) are listed with `enabled` set to `false`:

```http
{% include_relative examples/querystring/get.res %}
```
