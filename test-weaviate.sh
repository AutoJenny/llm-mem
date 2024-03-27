#!/bin/bash

curl -v -X POST \
     -H "Content-Type: application/json" \
     -d '{
  "classes": [
    {
      "class": "TestInteraction",
      "description": "A test class",
      "properties": [
        {
          "name": "testProperty",
          "description": "A test property",
          "dataType": ["string"]
        }
      ]
    }
  ]
}' \
     http://localhost:8080/v1/schema
