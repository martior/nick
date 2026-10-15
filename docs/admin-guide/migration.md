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
| Listing | Yes | `@search`, `@users` and `@groups` are read in batches of 100 (`batching.next`), so large sites are not loaded in one response. |
| Roles | Yes | Roles missing in Nick are added (without permissions). `Manager` and `Site Administrator` map to `Administrator`, `Member` maps to `Authenticated`. |
| Groups | Yes | Id, title, description, email and global roles. The virtual `AuthenticatedUsers` group is skipped. |
| Permissions | No | Zope permissions don't apply to Nick. Nick's own permissions are kept. |
| Actions | No | Plone actions are user interface settings with TALES conditions. Nick's own actions are kept. |
