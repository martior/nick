---
permalink: /rest-api/endpoints/searching
parent: Endpoints
---

# Search

## Searching content

Content can be searched for by invoking the `/@search` endpoint on any context:

```http
{% include_relative examples/search/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get.res %}
```

## Searching text

When you specify the `SearchableText` parameter you can search for specific content:

```http
{% include_relative examples/search/get_news.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_news.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_news.res %}
```

## Searching text with operators

The `SearchableText` parameter follows the Plone query syntax: multiple terms are combined with `AND`, the `AND`, `OR` and `NOT` keywords and parentheses can be used to combine terms, `"quoted text"` searches for a phrase and a trailing `*` searches for words starting with the term. Any other character is treated as plain text, so a search never fails because of its input. Accents are ignored when the `unaccent` extension is available in PostgreSQL, so `creme` will find `Crème`:

```http
{% include_relative examples/search/get_operators.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_operators.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_operators.res %}
```

## Sorting on title

You can also sort the search results on title:

```http
{% include_relative examples/search/get_sort_title.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_sort_title.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_sort_title.res %}
```

## Sorting on date

You can also sort the search results on date:

```http
{% include_relative examples/search/get_sort_date.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_sort_date.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_sort_date.res %}
```

## Sorting on unknown

When you sort on an unknown column it will be ignored:

```http
{% include_relative examples/search/get_sort_unknown.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_sort_unknown.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_sort_unknown.res %}
```

## Sorting reverse

You can also sort the search results reverse:

```http
{% include_relative examples/search/get_sort_reverse.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_sort_reverse.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_sort_reverse.res %}
```

## Sorting depth

You can specify the depth used to search:

```http
{% include_relative examples/search/get_depth.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_depth.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_depth.res %}
```

## Searching on keywords

Keyword indexes like `Subject` match when any of the given values is set. Use `Subject.operator=and` to require all values:

```http
{% include_relative examples/search/get_subject.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_subject.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_subject.res %}
```

## Searching on path

By default the search is limited to the current context and its children. Use `path.query` to search one or more other paths and `path.depth` to limit the depth. A depth of `0` returns only the path itself, a depth of `1` its direct children and so on:

```http
{% include_relative examples/search/get_path.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_path.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_path.res %}
```

## Searching on date ranges

Date (and number) indexes can be queried with a range by specifying `<index>.query` and `<index>.range`, the range being `min`, `max` or `min:max`:

```http
{% include_relative examples/search/get_range.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_range.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_range.res %}
```

## Selecting metadata fields

By default all metadata of the catalog is returned for every item. When `metadata_fields` is specified only `@id`, `@type`, `title`, `description` and `review_state` plus the requested metadata fields are returned. Use `metadata_fields=_all` to get all metadata:

```http
{% include_relative examples/search/get_metadata_fields.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_metadata_fields.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_metadata_fields.res %}
```

## Returning full objects

With `fullobjects=1` the full serialization of the content objects is returned instead of the catalog metadata, including a summary of the parent:

```http
{% include_relative examples/search/get_fullobjects.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_fullobjects.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_fullobjects.res %}
```

## Sorting using batching

Results are batched with a default batch size of 25. You can specify the batch size (`b_size`) and the batch start (`b_start`) when searching. Both have to be integers, the batch size not negative (a negative batch start is the start, like in Plone); any other value gives `400 Bad Request`, as does a `path.depth` that is not an integer or a value of a date index (for example `created.query`) that is not a date. `items_total` is the total number of results; when there is more than one batch a `batching` object with links to the current, first, last, next and previous batch is added:

```http
{% include_relative examples/search/get_batch.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_batch.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_batch.res %}
```

## Sorting using batch offset

You can specify the batch offset of the search:

```http
{% include_relative examples/search/get_offset.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_offset.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_offset.res %}
```

## Sorting on unknown

It will ignore unknown parameters:

```http
{% include_relative examples/search/get_unknown.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_unknown.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/get_unknown.res %}
```

## Sorting querystring search

You can also search using a `POST` call and specify a querystring:

```http
{% include_relative examples/search/post.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/post.ts %}
```

This will return all content object:

```http
{% include_relative examples/search/post.res %}
```

## Querystring operations

The operations can be specified by their full `plone.app.querystring` name, which is what Volto sends, or by their short name (for example `selection.any`). Path operations accept a depth suffix (`.::1`), multiple path rows are combined with `OR`, and the context itself is excluded from the results:

```http
{% include_relative examples/search/post_operations.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/post_operations.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/post_operations.res %}
```

The querystring search supports the same batching parameters in the body and a `limit` to cap the total number of results:

```http
{% include_relative examples/search/post_batch.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/post_batch.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/post_batch.res %}
```

The querystring search can also be called with a `GET` request, passing the JSON encoded body in the `query` parameter:

```http
{% include_relative examples/search/get_querystring.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/get_querystring.ts %}
```

This will return the matching content objects:

```http
{% include_relative examples/search/get_querystring.res %}
```

When no query is supplied or an operation is unknown a bad request is returned:

```http
{% include_relative examples/search/post_invalid.req %}
```

Or use the client directly:

```ts
{% include_relative examples/search/post_invalid.ts %}
```

Example response:

```http
{% include_relative examples/search/post_invalid.res %}
```

## Searching using an embedding model

When AI is enabled in the config you can search based on `embeddings`. When you provide a `SearchableText` parameter it will be converted to an `embedding` and compared with all other embeddings in the site. You can set the similarity cut off in the config by specifying `minSimilarity` in the embed model settings. Results are automatically ordered by similarity but can be ordered differently when specified.

```http
{% include_relative examples/search/get_embed.req %}

```

Or use the client directly:

```ts
{% include_relative examples/search/get_embed.ts %}
```

Example response:

```http
{% include_relative examples/search/get_embed.res %}
```
