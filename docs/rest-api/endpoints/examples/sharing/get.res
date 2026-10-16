HTTP/1.1 200 OK
Content-Type: application/json

{
  "available_roles": [
    {
      "id": "Contributor",
      "title": "Contributor"
    },
    {
      "id": "Editor",
      "title": "Editor"
    },
    {
      "id": "Reader",
      "title": "Reader"
    },
    {
      "id": "Reviewer",
      "title": "Reviewer"
    }
  ],
  "entries": [
    {
      "id": "AuthenticatedUsers",
      "title": "Logged-in users",
      "roles": {
        "Contributor": false,
        "Editor": false,
        "Reader": false,
        "Reviewer": false
      },
      "type": "group",
      "disabled": false
    }
  ],
  "inherit": true
}
