{
  "targets": [
    {
      "target_name": "leitor_memoria",
      "sources": [ "leitor_memoria.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_VERSION=8", "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}
