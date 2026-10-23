---
permalink: /rest-api/endpoints/contextnavigation
parent: Endpoints
---

# Context Navigation

## Context Navigation

The context navigation endpoint returns the navigation tree of the current location, like the navigation portlet of Plone and the `@contextnavigation` endpoint of plone.restapi. It has the same query parameters, prefixed with `expand.contextnavigation.`:

- `topLevel` (default `1`): the tree starts at the folder at this level in the path from the navigation root to the context; at `0` it starts at the navigation root. The first level lists all items; deeper levels only list the items in the path to the context, and below the context all items are listed. Above the top level the tree is empty.
- `bottomLevel` (default `0`, no limit): the number of levels to list.
- `currentFolderOnly` (default `false`): the tree starts at the current folder (the context if it is folderish, otherwise its parent) and lists all items below it.
- `root_path`: the path of the folder to use instead of the navigation root, like the root node of Plone's navigation portlet.
- `includeTop` (default `false`): the root of the tree is the first item.
- `name`: the title of the navigation (default `Navigation`); `has_custom_name` tells if it is set.

Items excluded from the navigation, of types not in the `displayed_types` of the navigation control panel or not viewable by the user are omitted. The response has the `available` flag (true when there are items), the `title` and the `url` of the root (the sitemap of the navigation root, the current folder with `currentFolderOnly`, or the root with `root_path`). Every item has the `@id`, `href`, `title`, `description`, `review_state`, `type` (the lowercase type), `normalized_id`, `is_current`, `is_in_path`, `is_folderish` and its `items`.

```http
{% include_relative examples/contextnavigation/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/contextnavigation/get.ts %}
```

Example response:

```http
{% include_relative examples/contextnavigation/get.res %}
```
