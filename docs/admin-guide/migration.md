---
title: Migration
nav_order: 4
permalink: /admin-guide/migration
parent: Admin guide
---

# Migration

`Nick` provides a migration script which can be used to export data (users, groups, roles, types, workflows, documents etc) from an existing running `Plone` or `Nick` website.

## Run migration

The migration can be run with the following command:

```shell
$ pnpm export <url> <login> <password> <profilename>
```

The `url` is the url of the running backend system, for example: `http://localhost:8080/Plone`

`login` and `password` are used to authenticate with the backend. Make sure to use a user with administator permissions.

`profilename` is the name of the profile that will be generated. The profile will be placed in `src/profiles/<profilename>`.

## Profile

All migrated data is placed in the above profile folder. This profile contains all data including users, groups, roles, types, documents and much more. This profile is meant to be applied on top of the `core` profile: it doesn't purge the users, roles, permissions and actions of `core`.

Each document is written to `documents/<path>.json`, where the path segments are separated by dots. Characters in ids other than letters, digits, `-` and `_` are escaped as `~<hex>` (for example `files.report~2epdf.json`), and the document contains its original `path`, which the import uses.

## What is migrated

| Data | Migrated | Notes |
| ---- | -------- | ----- |
| Content tree | Yes | Paths, ids (including ids with dots), types, uuids and field values. |
| Listing | Yes | `@search` and `@users` are read in batches of 100 (`batching.next`), so large sites are not loaded in one response. `@groups` is not batched by plone.restapi and read at once. Comments, which are cataloged, are skipped. The export stops with an error when a request fails. |
| Roles | Yes | Roles missing in Nick are added (without permissions). `Manager` and `Site Administrator` map to `Administrator`, `Member` maps to `Authenticated`. |
| Groups | Yes | Id, title, description, email and global roles. The virtual `AuthenticatedUsers` group is skipped. |
| Permissions | No | Zope permissions don't apply to Nick. Nick's own permissions are kept. |
| Actions | No | Plone actions are user interface settings with TALES conditions. Nick's own actions are kept. |
| Users | Partly | Id, full name, email, global roles, groups and other member properties (`description`, `location`, `home_page`). Portraits are not migrated. Password hashes are not available over the REST api, so every user gets its own random password and has to reset it. The user running the export keeps the password used for the export and is added as `Administrator` when it is not a site user (for example the Zope root `admin`). Users referenced by content (owners, actors) which no longer exist are added without roles, so history stays attributed. |

## Passwords

Password hashes are not available over the REST api. The generated `users.json` contains a random password per user in clear text, because the seed hashes them on import. Treat the profile as a secret and remove `users.json` (or the passwords) after the import. Users set a new password with the password reset of `Nick`.
