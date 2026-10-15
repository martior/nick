HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@search",
  "items": [
    {
      "@id": "http://localhost:8080/events/event-1",
      "@type": "Event",
      "title": "Event 1",
      "description": "",
      "review_state": "published",
      "UID": "405ca717-0c68-43a0-88ac-629a82658675",
      "Subject": [
        "event"
      ]
    },
    {
      "@id": "http://localhost:8080/events/event-2",
      "@type": "Event",
      "title": "Event 2",
      "description": "",
      "review_state": "published",
      "UID": "455ca717-0c68-43a0-88ac-629a82658675",
      "Subject": [
        "event"
      ]
    }
  ],
  "items_total": 2
}
