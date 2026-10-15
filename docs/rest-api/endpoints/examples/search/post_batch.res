HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@search",
  "items": [
    {
      "@id": "http://localhost:8080/events/event-2",
      "@type": "Event",
      "title": "Event 2",
      "Subject": [
        "event"
      ],
      "is_folderish": true,
      "exclude_from_nav": false,
      "UID": "455ca717-0c68-43a0-88ac-629a82658675",
      "path": "/events/event-2",
      "Description": null,
      "Title": "Event 2",
      "Type": "Event",
      "getId": "event-2",
      "Creator": "admin",
      "id": "event-2",
      "portal_type": "Event",
      "review_state": "published",
      "modified": "2023-04-02T20:10:00.000Z",
      "Date": "2023-04-02T20:10:00.000Z",
      "expires": null,
      "created": "2023-04-02T20:10:00.000Z",
      "effective": "2023-04-02T20:10:00.000Z",
      "getObjSize": 631,
      "listCreators": [
        "admin"
      ],
      "mime_type": null,
      "CreationDate": "2023-04-02T20:10:00.000Z",
      "EffectiveDate": "2023-04-02T20:10:00.000Z",
      "ExpirationDate": null,
      "ModificationDate": "2023-04-02T20:10:00.000Z",
      "image_field": "",
      "image_scales": {},
      "start": "2025-04-01T12:49:09.565Z",
      "end": "2025-04-08T12:49:11.379Z",
      "recurrence": "DTSTART:20250401T124909Z\nRRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20250408T124900Z",
      "deleted": false,
      "hasPreviewImage": false,
      "markdown": "# Event 2\n\nThis is the first event.\n\n",
      "position_in_parent": 1
    }
  ],
  "items_total": 3,
  "batching": {
    "@id": "http://localhost:8080/@querystring-search?b_start=1",
    "first": "http://localhost:8080/@querystring-search?b_start=0",
    "last": "http://localhost:8080/@querystring-search?b_start=2",
    "next": "http://localhost:8080/@querystring-search?b_start=2",
    "prev": "http://localhost:8080/@querystring-search?b_start=0"
  }
}
