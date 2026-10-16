---
permalink: /rest-api/endpoints/copymove
parent: Endpoints
---

# Copy and Move

## Copying an object

To copy a content object send a `POST` request to the `/@copy` endpoint at the destinations url with the source object specified in the request body. The source object can be specified by url, path or uuid. If the id is already used in the destination, the copy gets the id `copy_of_<id>`, then `copy2_of_<id>` and so on, like in Plone.

```http
{% include_relative examples/copymove/copy.req %}
```

Or use the client directly:

```ts
{% include_relative examples/copymove/copy.ts %}
```

If the copy operation succeeds, the server will respond with status 200 (OK) and return the new and old url of the copied object.

```http
{% include_relative examples/copymove/copy.res %}
```

## Moving an object

To move a content object send a `POST` request to the `/@move` endpoint at the destinations url with the source object specified in the request body. The source object can be specified by url, path or uuid.

```http
{% include_relative examples/copymove/move.req %}
```

Or use the client directly:

```ts
{% include_relative examples/copymove/move.ts %}
```

If the move operation succeeds, the server will respond with status `200 OK` and return the new and old url of the moved object.

```http
{% include_relative examples/copymove/move.res %}
```

## Copying/moving multiple objects

Multiple objects can be moved/copied by giving a list of sources.

Both endpoints require the `Add` permission on the destination. Sources that don't exist or that the user can't view are skipped, as in Plone. Moving also requires the `Delete` permission on the source or on its parent; otherwise the request fails with `403 Forbidden` and nothing is moved. Moving an object into itself or one of its children returns `400 Bad Request`. The permissions of a moved object are reindexed with the local roles of its new parent.

```http
{% include_relative examples/copymove/copy_multiple.req %}
```

Or use the client directly:

```ts
{% include_relative examples/copymove/copy_multiple.ts %}
```

If the operation succeeds, the server will respond with status `200 OK` and return the new and old urls for each copied/moved object.

```http
{% include_relative examples/copymove/copy_multiple.res %}
```
