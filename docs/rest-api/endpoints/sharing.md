---
permalink: /rest-api/endpoints/sharing
parent: Endpoints
---

# Sharing

Nick comes with a sophisticated user management system that allows to assign users and groups with global roles and permissions. Sometimes this in not enough though and you might want to give users the permission to access or edit a specific part of your website or a specific content object. This is where local roles located in the sharing tab come in handy.

## Retrieving Local Roles

The sharing information of a content object can be accessed by appending `/@sharing` to the `GET` request to the URL of a content object. E.g. to access the sharing information for a top-level folder, do:

```http
{% include_relative examples/sharing/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/sharing/get.ts %}
```

```http
{% include_relative examples/sharing/get.res %}
```

The `available_roles` property contains the list of roles that can be managed via the sharing page. Only roles the current user may delegate are listed: a role is delegatable with the `Delegate <role>` permission, like the `Sharing page: Delegate <role> role` permissions of Plone. The core profile gives `Delegate Reader` and `Delegate Editor` to `Editor`, `Delegate Reader`, `Delegate Contributor` and `Delegate Editor` to `Owner`, and all four to `Administrator`. Roles in a POST that the user may not delegate are ignored, so for example a local Editor can't grant `Reviewer`. It contains dictionaries with the role ID and its translated `title` (as it appears on the sharing page).

## Searching for principles

The `entries` list the users and groups with a local role on the object or one of the parents it inherits from. Users and/or groups without a sharing entry can be found by id, full name or group title by appending the argument `search` to the query string. ie `?search=admin`. Global roles are marked with the string `global`. Inherited roles are marked with the string `acquired`. Like in Plone, the group `AuthenticatedUsers` ("Logged-in users") is always listed: every authenticated user is a member of it, so a local role given to it applies to all logged-in users. Each entry has a `disabled` flag, which is `true` for the entry of the current user: like in Plone, the sharing page shows it but doesn't let the user change it.

```http
{% include_relative examples/sharing/get_search.req %}
```

Or use the client directly:

```ts
{% include_relative examples/sharing/get_search.ts %}
```

```http
{% include_relative examples/sharing/get_search.res %}
```

## Updating Local Roles

You can update the _sharing_ information by sending a `POST` request to the object URL and appending `/@sharing`, e.g. `/news/@sharing`. E.g. say you want to give the `Administrators` group the `Reader` local role for a folder:

```http
{% include_relative examples/sharing/post.req %}
```

Or use the client directly:

```ts
{% include_relative examples/sharing/post.ts %}
```

```http
{% include_relative examples/sharing/post.res %}
```

Both `inherit` and `entries` are optional: `{"inherit": false}` only blocks the inheritance of local roles and `{}` changes nothing. Every entry needs an `id`, a `type` (`user` or `group`) and a `roles` object; like in Plone, an entry is the complete set of the principal's local roles the user may delegate: roles set to `true` are granted, all other delegatable roles (set to `false` or not named) are revoked, and unknown roles and principals are ignored. Other data returns `400 Bad Request`.

After the local roles or the `inherit` flag change, the permissions in the catalog are reindexed for the object and every object below it, so `@search`, navigation and folder listings show the new permissions. Subtrees with fewer objects than `reindexSecurityLimit` (default `1000`, set it in `config.ts`) are reindexed within the request. Larger subtrees are reindexed by a `reindex_security` job that starts when the request is committed; until that job is finished, search results below the object may still use the old permissions. The job can be followed with the `@jobs` endpoint, and the same action can be used in a scheduled job to reindex the security of any path.
