---
permalink: /rest-api/endpoints/workflow
parent: Endpoints
---

# Workflow

All content has a workflow attached. We can get the current state and history of an object by issuing a `GET` request using on any context:

```http
{% include_relative examples/workflow/get.req %}
```

Or use the client directly:

```ts
{% include_relative examples/workflow/get.ts %}
```

```http
{% include_relative examples/workflow/get.res %}
```

Now, if we want to change the state of the front page to publish, we would proceed by issuing a `POST` request to the given URL:

```http
{% include_relative examples/workflow/post.req %}
```

Or use the client directly:

```ts
{% include_relative examples/workflow/post.ts %}
```

```http
{% include_relative examples/workflow/post.res %}
```

A transition requires the `View` permission on the object and the permission of the transition. The transition must be one of the transitions of the current state; an unknown transition or a transition that is not available in the current state returns `400 Bad Request` with an error of type `WorkflowException`:

```json
{
  "error": {
    "type": "WorkflowException",
    "message": "Transition submit is not available in the current state."
  }
}
```

Like in plone.restapi, the body can contain the publication dates `effective` and `expires`; they are set on the object (and with `include_children` on its children). An invalid date returns `400 Bad Request` and nothing is changed. When an object is published for the first time (it enters a state where `Anonymous` has `View`) and has no effective date, the effective date is set to the time of the transition; publishing it again keeps the first effective date.

A `POST` to `@workflow` without a transition returns `400 Bad Request`.

A transition to the state the object is already in is accepted and does nothing: the response is `200 OK` with the last transition and no new history entry is recorded.

With `include_children: true`, the transition is checked for every object below the object first, with the permissions the user has on that object. If it can't be applied to one of them, nothing is changed and `400 Bad Request` is returned. Children that already are in the new state are skipped.
