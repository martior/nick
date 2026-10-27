---
permalink: /rest-api/endpoints/breadcrumbs
parent: Endpoints
---

# Breadcrumbs

Getting the breadcrumbs for the current page:

```http
{% include_relative examples/breadcrumbs/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/breadcrumbs/get.ts %}
```

Example response, `root` is the url of the navigation root:

```http
{% include_relative examples/breadcrumbs/get.res %}
```

Ancestors the user may not view are left out, so the title of a private folder doesn't show up in the breadcrumbs of a published item inside it.
