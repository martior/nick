HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@users",
  "items": [
    {
      "@id": "http://localhost:8080/@users/admin",
      "description": "Admin user",
      "id": "admin",
      "location": "World",
      "fullname": "Admin",
      "email": "admin@example.com",
      "roles": [
        "Administrator"
      ],
      "username": "admin",
      "groups": []
    }
  ],
  "items_total": 1
}
