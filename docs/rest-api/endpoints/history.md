---
permalink: /rest-api/endpoints/history
parent: Endpoints
---

# History

The `@history` endpoint exposes history and versioning information on previous versions of the content. Each change or workflow change on a content object or file is listed. It also allows to revert to a previous version of the file.

Listing the history and getting a previous version require the `View History` permission, which the core profile gives to the `Owner`, `Contributor`, `Editor`, `Reviewer` and `Administrator` roles (like `CMFEditions: Access previous versions` in Plone). Users who can only view the content, such as anonymous users on published content, get `401 Unauthorized` or `403 Forbidden`.

## Listing the History of a Content Object

Listing versions and history of a resource:

```http
{% include_relative examples/history/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/history/get.ts %}
```

```http
{% include_relative examples/history/get.res %}
```

This following fields are returned:

- `action`: the workflow transition id, 'Edited' for versioning, or 'Create' for initial state.
- `actor`: the user who performed the action. This contains a subobject with the details.
- `comments`: the change note of a version (`null` if none was given), or the comment of a workflow transition. A revert has the comment 'Reverted to revision <version>'.
- `@id`: link to the content endpoint of this specific version.
- `may_revert`: true if the user has permission to revert.
- `time`: when this action occured in ISO format.
- `transition_title`: the workflow transition's title, 'Edited' for versioning.
- `type`: 'workflow' for workflow changes, or 'versioning' for editing
- `version`: identifier for this specific version of the resource.

Like in Plone, the creation of a resource is the first entry of its workflow history, without an action; `@history` lists it last as 'Create', with the initial workflow state. Content created before this was recorded and migrated content without such an entry have no 'Create' entry.

## Get a Historical Version

Older versions of a resource can be retrieved by appending version to the `@history` endpoint url.

The response contains the `version` number; the current content has `"version": "current"`. An unknown version returns `404 Not Found`.

```http
{% include_relative examples/history/get_version.req %}
```

Or use the client directly:

```ts
{% include_relative examples/history/get_version.ts %}
```

## Revert to a Historical Version

Reverting to an older versions of a resource can be done by sending a PATCH request to the `@history` endpoint and appending the version you want to revert to. Reverting requires the `Revert` permission, which the core profile gives to the `Owner`, `Editor`, `Reviewer` and `Administrator` roles (like `CMFEditions: Revert to previous versions` in Plone). Other users get `401 Unauthorized` or `403 Forbidden`, and `may_revert` is `false` for them in the history listing. An unknown version returns `404 Not Found`. The reverted content is reindexed in the catalog.

```http
{% include_relative examples/history/patch.req %}
```

Or use the client directly:

```ts
{% include_relative examples/history/patch.ts %}
```

```http
{% include_relative examples/history/patch.res %}
```
