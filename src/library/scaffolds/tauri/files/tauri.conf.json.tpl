{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "{{APP_NAME}}",
  "version": "{{APP_VERSION}}",
  "identifier": "{{APP_IDENTIFIER}}",
  "build": {
    "frontendDist": "./web",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "title": "{{APP_NAME}}",
        "width": 1360,
        "height": 860,
        "minWidth": 1024,
        "minHeight": 680,
        "center": true,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost",
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "publisher": "{{PUBLISHER}}",
    "copyright": "{{COPYRIGHT}}",
    "category": "Business",
    "shortDescription": "{{APP_SHORT_DESCRIPTION}}",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installMode": "currentUser",
        "languages": ["French", "English"]
      }
    }
  }
}
