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
      "id": "admin",
      "title": "Admin",
      "roles": {
        "Contributor": false,
        "Editor": false,
        "Reader": false,
        "Reviewer": false
      },
      "type": "user"
    },
    {
      "id": "Administrators",
      "title": "Administrators",
      "roles": {
        "Contributor": false,
        "Editor": false,
        "Reader": false,
        "Reviewer": false
      },
      "type": "group"
    },
    {
      "id": "AuthenticatedUsers",
      "title": "Logged-in users",
      "roles": {
        "Contributor": false,
        "Editor": false,
        "Reader": false,
        "Reviewer": false
      },
      "type": "group"
    }
  ],
  "inherit": true
}
