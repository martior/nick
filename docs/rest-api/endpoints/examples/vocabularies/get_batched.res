HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@vocabularies/roles",
  "items": [
    {
      "title": "Authenticated",
      "token": "Authenticated"
    },
    {
      "title": "Contributor",
      "token": "Contributor"
    }
  ],
  "items_total": 8,
  "batching": {
    "@id": "http://localhost:8080/@vocabularies/roles?b_size=2&b_start=2",
    "first": "http://localhost:8080/@vocabularies/roles?b_size=2&b_start=0",
    "last": "http://localhost:8080/@vocabularies/roles?b_size=2&b_start=6",
    "next": "http://localhost:8080/@vocabularies/roles?b_size=2&b_start=4",
    "prev": "http://localhost:8080/@vocabularies/roles?b_size=2&b_start=0"
  }
}
