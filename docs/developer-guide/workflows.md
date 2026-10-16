---
title: Workflows
parent: Developer guide
permalink: /developer-guide/workflows
---

# Workflows

Workflows define the review and publication states that content can move through. They are defined in a `workflows.json` file placed in a profile's directory and are automatically loaded when the profile is installed.

## Structure

```json
{
  "purge": true,
  "workflows": []
}
```

| Field       | Type      | Description                                                                      |
| ----------- | --------- | -------------------------------------------------------------------------------- |
| `purge`     | `boolean` | When `true`, all existing workflows are deleted before importing from this file. |
| `workflows` | `array`   | List of workflow definitions to create or update.                                |

### Workflow items

Each item in the `workflows` array has:

| Field              | Type     | Description                                                                |
| ------------------ | -------- | -------------------------------------------------------------------------- |
| `id`               | `string` | Unique identifier for the workflow (e.g. `"simple_publication_workflow"`). |
| `title:i18n`       | `string` | Display title.                                                             |
| `description:i18n` | `string` | Description of the workflow.                                               |
| `json`             | `object` | The workflow definition containing states and transitions.                 |

### The `json` object

| Field                 | Type     | Description                                                                                                    |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `initial_state`       | `string` | The state ID that content starts in when first created.                                                        |
| `states`              | `object` | A map of state IDs to their definitions.                                                                       |
| `transitions`         | `object` | A map of transition IDs to their definitions.                                                                  |
| `permission_model`    | `string` | `additive` or `acquire`, see [Permission models](#permission-models).                                          |
| `managed_permissions` | `array`  | Permissions managed by the workflow with the `acquire` model. Defaults to every permission used in the states. |

#### State definition

| Field              | Type     | Description                                                                                       |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `title:i18n`       | `string` | Display label for the state.                                                                      |
| `description:i18n` | `string` | Description of the state.                                                                         |
| `transitions`      | `array`  | Transition IDs available from this state.                                                         |
| `permissions`      | `object` | A map of role IDs to arrays of permission IDs granted in this state.                              |
| `acquire`          | `array`  | Managed permissions that also keep their global role grants in this state (`acquire` model only). |

#### Transition definition

| Field        | Type     | Description                                                         |
| ------------ | -------- | ------------------------------------------------------------------- |
| `title:i18n` | `string` | Display label for the transition.                                   |
| `new_state`  | `string` | The state ID the content moves to when this transition is executed. |
| `permission` | `string` | The permission required to execute this transition.                 |

If a workflow with the same `id` already exists, it is updated (merged) with the new definition.

## Permission models

The permissions of a user on a content object combine the permissions of the user's roles (global roles, local roles from `@sharing` and `Owner`) from `roles.json` with the permissions the workflow state gives those roles.

- `additive` (default): the state's permissions are added to the global role permissions. A state can't take a permission away from a role that has it globally, for example a user with the global `Reader` role can view content in every state.
- `acquire`: works like Plone's DCWorkflow. For every managed permission the roles listed in the state replace the global role permissions, unless the state lists the permission in `acquire` (the "acquire" checkbox in Plone). Permissions the workflow doesn't manage keep their global role permissions.

```json
{
  "permission_model": "acquire",
  "managed_permissions": ["View", "Modify"],
  "states": {
    "internal": {
      "permissions": { "Editor": ["View", "Modify"], "Reader": ["View"] },
      "acquire": ["Modify"]
    }
  }
}
```

In the `internal` state only `Editor` and `Reader` can view the content, whatever roles have `View` globally, while `Modify` is still given to roles that have it globally.

The permissions are stored in the catalog for search, so after changing the permission model or the permissions of a workflow, run a `reindex_security` job on `/` to rebuild them.

## Example

Place a file like `src/profiles/default/workflows.json`:

```json
{
  "workflows": [
    {
      "id": "my_workflow",
      "title:i18n": "My Workflow",
      "description:i18n": "Description of the workflow.",
      "json": {
        "initial_state": "draft",
        "states": {
          "draft": {
            "title:i18n": "Draft",
            "description:i18n": "Content is not yet visible.",
            "transitions": ["publish"],
            "permissions": {
              "Editor": ["View", "Modify"],
              "Administrator": ["View", "Modify"]
            }
          },
          "published": {
            "title:i18n": "Published",
            "description:i18n": "Visible to everyone.",
            "transitions": ["retract"],
            "permissions": {
              "Anonymous": ["View"],
              "Editor": ["Modify"],
              "Administrator": ["Modify"]
            }
          }
        },
        "transitions": {
          "publish": {
            "title:i18n": "Publish",
            "new_state": "published",
            "permission": "Review"
          },
          "retract": {
            "title:i18n": "Retract",
            "new_state": "draft",
            "permission": "Submit"
          }
        }
      }
    }
  ]
}
```

The file is picked up automatically during seeding — no manual registration is required. When `purge` is `false` or omitted, new workflows are added and existing ones are merged.

Upgrade `1013` gives `Owner` `View` and `Modify` in the `private` state, `View` in the `pending` state and `Modify` in the `published` state of `simple_publication_workflow`, like Plone's: the creator of an item can view and edit it while it is private, also without another local role.
