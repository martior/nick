HTTP/1.1 200 OK
Content-Type: application/json

{
  "@id": "http://localhost:8080/@querystring",
  "indexes": {
    "created": {
      "title": "Creation date",
      "description": "The date an item was created",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "Creator": {
      "title": "Creator",
      "description": "The person that created an item",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": "users",
      "operations": [
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.string.currentUser"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.string.currentUser": {
          "title": "Current logged in user",
          "widget": null,
          "operation": "currentUser",
          "description": "The user viewing the querystring results"
        }
      }
    },
    "Description": {
      "title": "Description",
      "description": "An item’s description",
      "group": "Text",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.contains"
      ],
      "operators": {
        "plone.app.querystring.operation.string.contains": {
          "title": "Contains",
          "widget": "StringWidget",
          "operation": "contains",
          "description": ""
        }
      }
    },
    "effective": {
      "title": "Effective date",
      "description": "The time and date an item was first published",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "end": {
      "title": "Event end date",
      "description": "The end date and time of an event",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "start": {
      "title": "Event start date",
      "description": "The start date and time of an event",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "expires": {
      "title": "Expiration date",
      "description": "The time and date an item was expired",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "isFolderish": {
      "title": "Folder-like",
      "description": "Find items that can contain other objects",
      "group": "Metadata",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.boolean.isTrue",
        "plone.app.querystring.operation.boolean.isFalse"
      ],
      "operators": {
        "plone.app.querystring.operation.boolean.isTrue": {
          "title": "Yes",
          "widget": null,
          "operation": "isTrue",
          "description": ""
        },
        "plone.app.querystring.operation.boolean.isFalse": {
          "title": "No",
          "widget": null,
          "operation": "isFalse",
          "description": ""
        }
      }
    },
    "path": {
      "title": "Location",
      "description": "The location of an item",
      "group": "Metadata",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.path",
        "plone.app.querystring.operation.string.absolutePath",
        "plone.app.querystring.operation.string.relativePath"
      ],
      "operators": {
        "plone.app.querystring.operation.string.path": {
          "title": "Navigation path",
          "widget": "ReferenceWidget",
          "operation": "navigationPath",
          "description": "Location in the navigation structure"
        },
        "plone.app.querystring.operation.string.absolutePath": {
          "title": "Absolute path",
          "widget": "ReferenceWidget",
          "operation": "absolutePath",
          "description": "Location in the site structure"
        },
        "plone.app.querystring.operation.string.relativePath": {
          "title": "Relative path",
          "widget": "RelativePathWidget",
          "operation": "relativePath",
          "description": "Use '../' to navigate to parent objects."
        }
      }
    },
    "modified": {
      "title": "Modification date",
      "description": "The time and date an item was last modified",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "getObjPositionInParent": {
      "title": "Order in folder",
      "description": "The order of an item in its parent folder",
      "group": "Metadata",
      "enabled": false,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.int.is",
        "plone.app.querystring.operation.int.lessThan",
        "plone.app.querystring.operation.int.largerThan"
      ],
      "operators": {
        "plone.app.querystring.operation.int.is": {
          "title": "Equals",
          "widget": "StringWidget",
          "operation": "intEqual",
          "description": ""
        },
        "plone.app.querystring.operation.int.lessThan": {
          "title": "Less than",
          "widget": "StringWidget",
          "operation": "intLessThan",
          "description": ""
        },
        "plone.app.querystring.operation.int.largerThan": {
          "title": "Larger than",
          "widget": "StringWidget",
          "operation": "intLargerThan",
          "description": ""
        }
      }
    },
    "SearchableText": {
      "title": "Searchable text",
      "description": "Text search of an item’s contents",
      "group": "Text",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.contains"
      ],
      "operators": {
        "plone.app.querystring.operation.string.contains": {
          "title": "Contains",
          "widget": "StringWidget",
          "operation": "contains",
          "description": ""
        }
      }
    },
    "getId": {
      "title": "Short name (id)",
      "description": "The short name of an item (used in the url)",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.is"
      ],
      "operators": {
        "plone.app.querystring.operation.string.is": {
          "title": "Is",
          "widget": "StringWidget",
          "operation": "equal",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    },
    "sortable_title": {
      "title": "Sortable Title",
      "description": "The item’s title, transformed for sorting",
      "group": "Text",
      "enabled": false,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.is",
        "plone.app.querystring.operation.string.contains"
      ],
      "operators": {
        "plone.app.querystring.operation.string.is": {
          "title": "Is",
          "widget": "StringWidget",
          "operation": "equal",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.string.contains": {
          "title": "Contains",
          "widget": "StringWidget",
          "operation": "contains",
          "description": ""
        }
      }
    },
    "Subject": {
      "title": "Tag",
      "description": "Tags are used for organization of content",
      "group": "Text",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": "subjects",
      "operations": [
        "plone.app.querystring.operation.selection.all",
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.selection.none"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.all": {
          "title": "Matches all conditions",
          "widget": "MultipleSelectionWidget",
          "operation": "all",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.selection.none": {
          "title": "Matches none of",
          "widget": "MultipleSelectionWidget",
          "operation": "excludes",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    },
    "Title": {
      "title": "Title",
      "description": "Text search of an item’s title",
      "group": "Text",
      "enabled": true,
      "sortable": false,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.contains"
      ],
      "operators": {
        "plone.app.querystring.operation.string.contains": {
          "title": "Contains",
          "widget": "StringWidget",
          "operation": "contains",
          "description": ""
        }
      }
    },
    "review_state": {
      "title": "Review state",
      "description": "An item’s workflow state (e.g.published)",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {
        "pending": {
          "title": "Pending review"
        },
        "private": {
          "title": "Private"
        },
        "published": {
          "title": "Published"
        }
      },
      "vocabulary": "workflowStates",
      "operations": [
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.selection.none"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.selection.none": {
          "title": "Matches none of",
          "widget": "MultipleSelectionWidget",
          "operation": "excludes",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    },
    "portal_type": {
      "title": "Type",
      "description": "An item’s type (e.g. Event)",
      "group": "Metadata",
      "enabled": true,
      "sortable": false,
      "values": {
        "Event": {
          "title": "Event"
        },
        "Feed": {
          "title": "Feed"
        },
        "File": {
          "title": "File"
        },
        "Folder": {
          "title": "Folder"
        },
        "Image": {
          "title": "Image"
        },
        "Page": {
          "title": "Page"
        },
        "Site": {
          "title": "Site"
        },
        "Video": {
          "title": "Video"
        }
      },
      "vocabulary": "types",
      "operations": [
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.selection.none"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.selection.none": {
          "title": "Matches none of",
          "widget": "MultipleSelectionWidget",
          "operation": "excludes",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    }
  },
  "sortable_indexes": {
    "created": {
      "title": "Creation date",
      "description": "The date an item was created",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "Creator": {
      "title": "Creator",
      "description": "The person that created an item",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": "users",
      "operations": [
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.string.currentUser"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.string.currentUser": {
          "title": "Current logged in user",
          "widget": null,
          "operation": "currentUser",
          "description": "The user viewing the querystring results"
        }
      }
    },
    "effective": {
      "title": "Effective date",
      "description": "The time and date an item was first published",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "end": {
      "title": "Event end date",
      "description": "The end date and time of an event",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "start": {
      "title": "Event start date",
      "description": "The start date and time of an event",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "expires": {
      "title": "Expiration date",
      "description": "The time and date an item was expired",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "modified": {
      "title": "Modification date",
      "description": "The time and date an item was last modified",
      "group": "Dates",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.date.today",
        "plone.app.querystring.operation.date.between",
        "plone.app.querystring.operation.date.lessThan",
        "plone.app.querystring.operation.date.afterToday",
        "plone.app.querystring.operation.date.largerThan",
        "plone.app.querystring.operation.date.beforeToday",
        "plone.app.querystring.operation.date.afterRelativeDate",
        "plone.app.querystring.operation.date.beforeRelativeDate",
        "plone.app.querystring.operation.date.lessThanRelativeDate",
        "plone.app.querystring.operation.date.largerThanRelativeDate"
      ],
      "operators": {
        "plone.app.querystring.operation.date.today": {
          "title": "Today",
          "widget": null,
          "operation": "today",
          "description": "The current day"
        },
        "plone.app.querystring.operation.date.between": {
          "title": "Between dates",
          "widget": "DateRangeWidget",
          "operation": "between",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.lessThan": {
          "title": "Before date",
          "widget": "DateWidget",
          "operation": "lessThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.afterToday": {
          "title": "After today",
          "widget": null,
          "operation": "afterToday",
          "description": "After the current day"
        },
        "plone.app.querystring.operation.date.largerThan": {
          "title": "After date",
          "widget": "DateWidget",
          "operation": "largerThan",
          "description": "Please use YYYY/MM/DD."
        },
        "plone.app.querystring.operation.date.beforeToday": {
          "title": "Before today",
          "widget": null,
          "operation": "beforeToday",
          "description": "Before the current day"
        },
        "plone.app.querystring.operation.date.afterRelativeDate": {
          "title": "After relative date",
          "widget": "RelativeDateWidget",
          "operation": "afterRelativeDate",
          "description": "After N days in the future"
        },
        "plone.app.querystring.operation.date.beforeRelativeDate": {
          "title": "Before relative date",
          "widget": "RelativeDateWidget",
          "operation": "beforeRelativeDate",
          "description": "Before N days in the past"
        },
        "plone.app.querystring.operation.date.lessThanRelativeDate": {
          "title": "Within next",
          "widget": "RelativeDateWidget",
          "operation": "lessThanRelativeDate",
          "description": "Please enter the number in days."
        },
        "plone.app.querystring.operation.date.largerThanRelativeDate": {
          "title": "Within last",
          "widget": "RelativeDateWidget",
          "operation": "moreThanRelativeDate",
          "description": "Please enter the number in days."
        }
      }
    },
    "getObjPositionInParent": {
      "title": "Order in folder",
      "description": "The order of an item in its parent folder",
      "group": "Metadata",
      "enabled": false,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.int.is",
        "plone.app.querystring.operation.int.lessThan",
        "plone.app.querystring.operation.int.largerThan"
      ],
      "operators": {
        "plone.app.querystring.operation.int.is": {
          "title": "Equals",
          "widget": "StringWidget",
          "operation": "intEqual",
          "description": ""
        },
        "plone.app.querystring.operation.int.lessThan": {
          "title": "Less than",
          "widget": "StringWidget",
          "operation": "intLessThan",
          "description": ""
        },
        "plone.app.querystring.operation.int.largerThan": {
          "title": "Larger than",
          "widget": "StringWidget",
          "operation": "intLargerThan",
          "description": ""
        }
      }
    },
    "getId": {
      "title": "Short name (id)",
      "description": "The short name of an item (used in the url)",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.is"
      ],
      "operators": {
        "plone.app.querystring.operation.string.is": {
          "title": "Is",
          "widget": "StringWidget",
          "operation": "equal",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    },
    "sortable_title": {
      "title": "Sortable Title",
      "description": "The item’s title, transformed for sorting",
      "group": "Text",
      "enabled": false,
      "sortable": true,
      "values": {},
      "vocabulary": null,
      "operations": [
        "plone.app.querystring.operation.string.is",
        "plone.app.querystring.operation.string.contains"
      ],
      "operators": {
        "plone.app.querystring.operation.string.is": {
          "title": "Is",
          "widget": "StringWidget",
          "operation": "equal",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.string.contains": {
          "title": "Contains",
          "widget": "StringWidget",
          "operation": "contains",
          "description": ""
        }
      }
    },
    "review_state": {
      "title": "Review state",
      "description": "An item’s workflow state (e.g.published)",
      "group": "Metadata",
      "enabled": true,
      "sortable": true,
      "values": {
        "pending": {
          "title": "Pending review"
        },
        "private": {
          "title": "Private"
        },
        "published": {
          "title": "Published"
        }
      },
      "vocabulary": "workflowStates",
      "operations": [
        "plone.app.querystring.operation.selection.any",
        "plone.app.querystring.operation.selection.none"
      ],
      "operators": {
        "plone.app.querystring.operation.selection.any": {
          "title": "Matches any condition",
          "widget": "MultipleSelectionWidget",
          "operation": "contains",
          "description": "Tip: you can use * to autocomplete."
        },
        "plone.app.querystring.operation.selection.none": {
          "title": "Matches none of",
          "widget": "MultipleSelectionWidget",
          "operation": "excludes",
          "description": "Tip: you can use * to autocomplete."
        }
      }
    }
  }
}
