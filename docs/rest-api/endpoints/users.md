---
permalink: /rest-api/endpoints/users
parent: Endpoints
---

# Users

Available users can be created, queried, updated and deleted by interacting with the `/@users` endpoint on portal root (requires an authenticated user):

## List Users

To retrieve a list of all current users in the portal, call the `/@users` endpoint with a `GET` request:

```http
{% include_relative examples/users/list.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/list.ts %}
```

The server will respond with all users in the portal in `items`, and their number in `items_total`:

```http
{% include_relative examples/users/list.res %}
```

This only works for Manager users, anonymous users or logged-in users without Manager rights are now allowed to list users. This is the example as an anonymous user:

```http
{% include_relative examples/users/list_anonymous.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/list_anonymous.ts %}
```

The server will return a 401 Unauthorized status code

```http
{% include_relative examples/users/list_anonymous.res %}
```

The endpoint supports some basic filtering:

```http
{% include_relative examples/users/list_query.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/list_query.ts %}
```

The server will respond with the users whose username contains the query.

```http
{% include_relative examples/users/list_query.res %}
```

To search users by username, full name or email address use the `search` parameter:

```http
{% include_relative examples/users/list_search.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/list_search.ts %}
```

```http
{% include_relative examples/users/list_search.res %}
```

The `groups-filter:list` parameter (which can be repeated) only returns members of one of the given groups:

```http
{% include_relative examples/users/list_groups_filter.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/list_groups_filter.ts %}
```

When `query`, `search`, `groups-filter:list` or `limit` is used, at most `limit` users are returned, 25 by default.

## Create User

To create a new user, send a `POST` request to the global `/@users` endpoint with a JSON representation of the user you want to create in the body:

```http
{% include_relative examples/users/post.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/post.ts %}
```

If the user has been created successfully, the server will respond with a status `201 Created`. The `Location` header contains the URL of the newly created user and the resource representation in the payload:

```http
{% include_relative examples/users/post.res %}
```

The email address must be valid. The password must be at least 8 characters long. When no password is given, `"sendPasswordReset": true` must be passed so the user can set one. Otherwise the server responds with a `400 Bad Request`:

```http
{% include_relative examples/users/post_short_password.res %}
```

## Read User

To retrieve all details for a particular user, send a `GET` request to the `/@users` endpoint and append the user id to the URL:

```http
{% include_relative examples/users/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/get.ts %}
```

The server will respond with a `200 OK` status code and the JSON representation of the user in the body:

```http
{% include_relative examples/users/get.res %}
```

Only users with Manager rights are allowed to get other users' information:

```http
{% include_relative examples/users/get_anonymous.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/get_anonymous.ts %}
```

If the user lacks this rights, the server will respond with a `401 Unauthorized` status code:

```http
{% include_relative examples/users/get_anonymous.res %}
```

If the specified user doesn't exist:

```http
{% include_relative examples/users/get_notfound.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/get_notfound.ts %}
```

The server will respond with a `404 Not Found` status code:

```http
{% include_relative examples/users/get_notfound.res %}
```

## Update User

To update the settings of a user, send a `PATCH` request with the user details you want to amend to the URL of that particular user, e.g. if you want to update the email address of the admin user to:

```http
{% include_relative examples/users/patch.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/patch.ts %}
```

A successful response to a `PATCH` request will be indicated by a `204 No Content` response:

```http
{% include_relative examples/users/patch.res %}
```

Like on create, an invalid email address gives `400 Bad Request` and the user is not changed.

Users without the `Manage Users` permission can update their own properties, like their full name and email address:

```http
{% include_relative examples/users/patch_own.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/patch_own.ts %}
```

Their roles, groups, username and password can't be changed this way and are ignored. Updating another user answers `403 Forbidden`.

A user with the `Manage Users` permission can also set the password of a user:

```http
{% include_relative examples/users/patch_password.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/patch_password.ts %}
```

The password must be at least 8 characters long. A shorter password is refused with a `400 Bad Request`:

```http
{% include_relative examples/users/patch_password_short.res %}
```

## Delete User

Deleting a user never deletes content. The content the user owned, its children and the versions the user made are kept; their owner or actor is cleared, and history entries still show the id of the deleted user. Local roles, group memberships and tokens of the user are removed.

To delete a user send a `DELETE` request to the `/@users` endpoint and append the user id of the user you want to delete, e.g. to delete the user with the id johndoe:

```http
{% include_relative examples/users/delete.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/delete.ts %}
```

A successful response will be indicated by a `204 No Content` response:

```http
{% include_relative examples/users/delete.res %}
```

If the user doesn't exist, the server responds with a `404 Not Found`.

## User Registration

If user registration is enabled, an anonymous user can register a new user using the user creation endpoint. Enable it with `enable_self_reg` in the `security` control panel (or `userRegistration` in `config.ts`). Self-registering users cannot set roles or groups (`401 Unauthorized`), and their password is only stored when `enable_user_pwd_choice` is enabled in the `security` control panel; otherwise they set it with a password reset.

To create a new user send a `POST` request to the `@users` endpoint:

```http
{% include_relative examples/users/post_registration.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/post_registration.ts %}
```

If the user should receive an email to set her password, you should pass `"sendPasswordReset": true` in the JSON body of the request. Keep in mind that Plone will send a URL that points to the URL of the Plone site, which might just be your API endpoint.

If the user has been created, the server will respond with a `201 Created` response:

```http
{% include_relative examples/users/post_registration.res %}
```

## Reset User Password

Plone allows to reset a password for a user by sending a `POST` request to the user resource and appending `/reset-password` to the URL:

```http
{% include_relative examples/users/reset_password_mail.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/reset_password_mail.ts %}
```

The server will respond with a `200 OK` response and send an email to the user to reset her password.

```http
{% include_relative examples/users/reset_password_mail.res %}
```

The token that is part of the reset url in the email can be used to authorize setting a new password:

```http
{% include_relative examples/users/reset_password_set.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/reset_password_set.ts %}
```

```http
{% include_relative examples/users/reset_password_set.res %}
```

### Reset Own Password

Users can also reset their own password directly without sending an email. The endpoint and the request is the same as above, but now the user can send the old password and the new password as payload:

```http
{% include_relative examples/users/reset_password_own.req %}
```

Or use the client directly:

```ts
{% include_relative examples/users/reset_password_own.ts %}
```

The server will respond with a 200 OK response without sending an email.

```http
{% include_relative examples/users/reset_password_own.res %}
```

If the old password is wrong, or the logged in user is not the user whose password is changed, the server responds with a `403 Forbidden` and the password stays the same:

```http
{% include_relative examples/users/reset_password_own_wrong.res %}
```
