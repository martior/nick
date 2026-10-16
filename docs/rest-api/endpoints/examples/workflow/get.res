HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/news/@workflow",
  "history": [
    {
      "action": "publish",
      "actor": "admin",
      "comments": "",
      "review_state": "published",
      "time": "2022-04-03T20:22:00.000Z",
      "title": "Published"
    }
  ],
  "state": {
    "id": "published",
    "title": "Published"
  },
  "transitions": [
    {
      "@id": "http://localhost:8080/news/@workflow/reject",
      "title": "Send back"
    },
    {
      "@id": "http://localhost:8080/news/@workflow/retract",
      "title": "Retract"
    }
  ]
}
