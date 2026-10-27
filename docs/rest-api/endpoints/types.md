---
permalink: /rest-api/endpoints/types
parent: Endpoints
---

# Types

Available content types can be listed and queried by accessing the `/@types` endpoint on any context (requires an authenticated user). The 'addable' key specifies if the content type can be added to the current context.

```http
{% include_relative examples/types/list.req %}
```

Or use the client directly:

```ts
{% include_relative examples/types/list.ts %}
```

```http
{% include_relative examples/types/list.res %}
```

## Get the schema with GET

To get the schema of a content type, access the `/@types` endpoint with the name of the content type, e.g. /@types/Page:

```http
{% include_relative examples/types/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/types/get.ts %}
```

```http
{% include_relative examples/types/get.res %}
```

The schema is returned with the content type `application/json+schema`, like in plone.restapi. Like the `@types` listing, it is only available to authenticated users; anonymous users get `401 Unauthorized`. Every type in the listing has its `id` and, besides `addable`, `immediately_addable`.

## Get a field or a fieldset

`/@types/<type>/<name>` returns the JSON schema of the field or the fieldset with that name, e.g. `/@types/Page/title` or `/@types/Page/default`, or `404 Not Found`.

## Change the schema through the web

Users with the `Manage Site` permission can add fields and fieldsets to the schema of a type, change them and remove them, like with the plone.restapi `@types` endpoint. Fields and fieldsets of behaviors can't be changed or removed this way.

Add a fieldset with a `POST` to `/@types/<type>` with the factory `fieldset`; the response is `201 Created` with the fieldset:

```json
{
  "factory": "fieldset",
  "title": "Extra",
  "description": "Extra fields"
}
```

Add a field with one of the factories `Text line (String)`, `Text`, `Integer`, `Floating-point number`, `Yes/No`, `Date`, `Date/Time`, `Email`, `URL`, `File`, `Image` and `JSONField`. The id is made from the title unless `id` is given; `fieldset_id` is the id or the index of the fieldset (default: the first fieldset), and `required` makes the field required. The response is `201 Created` with the JSON schema of the field. An unknown factory or an existing id returns `400 Bad Request`.

```json
{
  "factory": "Text line (String)",
  "title": "Author name",
  "description": "Name of the author",
  "required": true,
  "fieldset_id": "extra"
}
```

Change the `title`, `description`, `default`, `minLength`, `maxLength` or `required` of a field, or the `title` and `description` of a fieldset, with a `PATCH` to `/@types/<type>/<name>`, and remove a field or a fieldset (with its fields) with a `DELETE` to `/@types/<type>/<name>`. Both return `204 No Content`.
