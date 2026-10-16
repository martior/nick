---
permalink: /rest-api/endpoints/vocabularies
parent: Endpoints
---

# Vocabularies

Vocabularies are a set of allowed choices that back a particular field. They contain so called _terms_ which represent those allowed choices.

## Concepts

**Vocabularies** contain a list of terms. These terms are usually tokenized, meaning that in addition to a term's value, it also has a `token` which is a machine-friendly identifier for the term.

Terms can also have a title, which is intended to be the user-facing label for the term.

Vocabularies can be context-sensitive, meaning that they take the context into account and their contents may therefore change depending on the context they're invoked on.

## Listing all vocabularies

To retrieve a list of all the available vocabularies, send a `GET` request to the `@vocabularies` endpoint:

```http
{% include_relative examples/vocabularies/list.req %}
```

Or use the client directly:

```ts
{% include_relative examples/vocabularies/list.ts %}
```

The response will include a list with the URL (`@id`) and the names (`title`) of all the available vocabularies:

```http
{% include_relative examples/vocabularies/list.res %}
```

## Get a vocabulary

To enumerate the terms of a particular vocabulary, use the `@vocabularies` endpoint with the name of the vocabulary, e.g. `/@vocabularies/roles`. The endpoint can be used with the site root and content objects.

```http
{% include_relative examples/vocabularies/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/vocabularies/get.ts %}
```

The server will respond with a list of terms. The title is purely for display purposes. The token is what should be sent to the server to address that term.

```http
{% include_relative examples/vocabularies/get.res %}
```

### plone.app.vocabularies names

For compatibility with Volto and other plone.restapi clients the following `plone.app.vocabularies` names are available as well. They return the same terms as the Nick vocabulary they map to:

| Name                                                  | Nick vocabulary       |
| ----------------------------------------------------- | --------------------- |
| `plone.app.vocabularies.AvailableContentLanguages`    | `supportedLanguages`  |
| `plone.app.vocabularies.Groups`                       | `groups`              |
| `plone.app.vocabularies.ImagesScales`                 | `imageScales`         |
| `plone.app.vocabularies.Keywords`                     | `subjects`            |
| `plone.app.vocabularies.MetadataFields`               | `metadataFields`      |
| `plone.app.vocabularies.Month`                        | `months`              |
| `plone.app.vocabularies.MonthAbbr`                    | `monthsAbbr`          |
| `plone.app.vocabularies.PortalTypes`                  | `types`               |
| `plone.app.vocabularies.Principals`                   | `principals`          |
| `plone.app.vocabularies.ReallyUserFriendlyTypes`      | `types`               |
| `plone.app.vocabularies.Roles`                        | `roles`               |
| `plone.app.vocabularies.SupportedContentLanguages`    | `availableLanguages`  |
| `plone.app.vocabularies.Timezones`                    | `timezones`           |
| `plone.app.vocabularies.UserFriendlyTypes`            | `types`               |
| `plone.app.vocabularies.Users`                        | `users`               |
| `plone.app.vocabularies.Weekdays`                     | `weekdays`            |
| `plone.app.vocabularies.WeekdaysAbbr`                 | `weekdaysAbbr`        |
| `plone.app.vocabularies.Workflows`                    | `workflows`           |
| `plone.app.vocabularies.WorkflowStates`               | `workflowStates`      |
| `plone.app.vocabularies.WorkflowTransitions`          | `workflowTransitions` |

```http
{% include_relative examples/vocabularies/get_plone_weekdays.req %}
```

Or use the client directly:

```ts
{% include_relative examples/vocabularies/get_plone_weekdays.ts %}
```

```http
{% include_relative examples/vocabularies/get_plone_weekdays.res %}
```

### Filter terms

The terms can be filtered by `title`, which returns the terms whose title contains the value (ignoring case), or by `token`, which returns the term with that token (ignoring case). Both can't be used at the same time.

```http
{% include_relative examples/vocabularies/get_title.req %}
```

Or use the client directly:

```ts
{% include_relative examples/vocabularies/get_title.ts %}
```

```http
{% include_relative examples/vocabularies/get_title.res %}
```

### Batching

Pass `b_size` (and optionally `b_start`) to get a batch of the terms. `items_total` is the number of all (filtered) terms and `batching` contains the links to the other batches.

```http
{% include_relative examples/vocabularies/get_batched.req %}
```

Or use the client directly:

```ts
{% include_relative examples/vocabularies/get_batched.ts %}
```

```http
{% include_relative examples/vocabularies/get_batched.res %}
```

### Protected vocabularies

Like in Plone, some vocabularies need more than the `View` permission. `users`, `subjects`, `plone.app.vocabularies.Users` and `plone.app.vocabularies.Keywords` need the `Modify` permission on the context. Anonymous users get a `401 Unauthorized`, other users a `403 Forbidden`:

```http
{% include_relative examples/vocabularies/get_users_anonymous.req %}
```

```http
{% include_relative examples/vocabularies/get_users_anonymous.res %}
```

Code based vocabularies can be protected by passing a permission when registering them: `vocabularies.register('myVocab', myVocab, 'Modify')`.
