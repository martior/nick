HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "@schema": {
      "fieldsets": [
        {
          "fields": [
            "type"
          ],
          "id": "default",
          "title": "Default"
        }
      ],
      "properties": {
        "type": {
          "additionalItems": true,
          "description": "The content type to reindex.",
          "factory": "Multiple Choice",
          "items": {
            "description": "",
            "factory": "Choice",
            "title": "",
            "type": "string",
            "vocabulary": {
              "@id": "types"
            }
          },
          "title": "Content type",
          "type": "array",
          "uniqueItems": true
        }
      },
      "required": [
        "type"
      ],
      "type": "object"
    },
    "addview": "reindex",
    "description": "Reindex items based on type",
    "title": "Reindex items"
  },
  {
    "@schema": {
      "fieldsets": [
        {
          "fields": [
            "path"
          ],
          "id": "default",
          "title": "Default"
        }
      ],
      "properties": {
        "path": {
          "description": "Path of the item, for example /news.",
          "factory": "Text line (String)",
          "title": "Path",
          "type": "string"
        }
      },
      "required": [
        "path"
      ],
      "type": "object"
    },
    "addview": "reindex_security",
    "description": "Reindex the permissions of an item and the items below it",
    "title": "Reindex security"
  }
]
