HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@search",
  "items": [
    {
      "title": "News",
      "blocks": {
        "79ba8858-1dd3-4719-b731-5951e32fbf79": {
          "@type": "title"
        }
      },
      "effective": "2022-04-02T20:22:00.000Z",
      "description": "News Items",
      "blocks_layout": {
        "items": [
          "79ba8858-1dd3-4719-b731-5951e32fbf79"
        ]
      },
      "@components": {
        "catalog": {
          "@id": "http://localhost:8080/news/@catalog"
        },
        "actions": {
          "@id": "http://localhost:8080/news/@actions"
        },
        "breadcrumbs": {
          "@id": "http://localhost:8080/news/@breadcrumbs"
        },
        "contextnavigation": {
          "@id": "http://localhost:8080/news/@contextnavigation"
        },
        "navigation": {
          "@id": "http://localhost:8080/news/@navigation"
        },
        "navroot": {
          "@id": "http://localhost:8080/news/@navroot"
        },
        "related": {
          "@id": "http://localhost:8080/news/@related"
        },
        "types": {
          "@id": "http://localhost:8080/news/@types"
        },
        "workflow": {
          "@id": "http://localhost:8080/news/@workflow"
        },
        "translations": {
          "@id": "http://localhost:8080/news/@translations"
        },
        "inherit": {
          "@id": "http://localhost:8080/news/@inherit"
        }
      },
      "@id": "http://localhost:8080/news",
      "@type": "Folder",
      "id": "news",
      "created": "2022-04-02T20:22:00.000Z",
      "modified": "2022-04-02T20:22:00.000Z",
      "UID": "32215c67-86de-462a-8cc0-eabcd2b39c26",
      "owner": "admin",
      "layout": "view",
      "is_folderish": true,
      "language": {
        "token": "en",
        "title": "English"
      },
      "review_state": "published",
      "lock": {
        "locked": false,
        "stealable": true
      },
      "parent": {
        "@id": "http://localhost:8080",
        "@type": "Site",
        "title": "Welcome to Nick!",
        "description": "Congratulations! You have successfully installed Nick.",
        "review_state": "published"
      }
    }
  ],
  "items_total": 1
}
