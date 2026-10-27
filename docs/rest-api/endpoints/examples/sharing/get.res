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
        "Reader": false,
        "Contributor": false,
        "Editor": false,
        "Reviewer": false
      },
      "type": "group",
      "disabled": false
    }
  ],
  "inherit": true
}