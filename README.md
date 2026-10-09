# Zenisai
> A simple, installable, offline-first music player.

This repository contains the source code for Zenisai, a **Progressive Web App (PWA)** built with vanilla HTML, CSS, and JavaScript. It's designed to be fast, reliable, and installable on any device (mobile or desktop).

---

## ✨ Features

* **Offline First:** Uses a Service Worker (`sw.js`) to cache all essential assets, allowing the app to load and function even without an internet connection.
* **Installable:** Includes a Web App Manifest (`manifest.json`) so users can "Add to Home Screen" on mobile or "Install" on desktop for a native-app experience.
* **Responsive Design:** A mobile-first design that adapts to all screen sizes.
* **Cross-Platform:** Works on any device with a modern web browser.

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You just need a modern web browser. To test the service worker, you'll need to run it from a local server. The easiest way is using the `live-server` VS Code extension or a simple Python server.

### AI Assistant Setup

The text and live-voice assistants require a Google Gemini API key. Copy `.env.example` to `.env.local`, replace the placeholder with a key enabled for the Gemini API, and restart Vite:

```sh
cp .env.example .env.local
npm run dev
```

The key is ignored by Git through the `*.local` rule. In Vercel, set `GEMINI_API_KEY` in the project's environment variables. Text requests run in `/api/assistant`; live voice uses a short-lived token from `/api/live-token`, so the permanent key is not sent to the browser. Restrict the key's API access and quota in Google Cloud.

### Installation

1.  **Clone the repo:**
    ```sh
    git clone [https://github.com/](https://github.com/)AdithyaBhaskar25/Zenisai.git
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd Zenisai
    ```
3.  **Start a local server:**
    If you have Python 3:
    ```sh
    python -m http.server
    ```
    Or with Node.js (if you have `http-server` installed):
    ```sh
    http-server -c-1
    ```
4.  Open your browser and go to `http://localhost:8000` (or the port your server indicates).

---

## 📂 File Structure

The project follows a standard web-app structure.
```
.
├── icons/
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   └── favicon.ico
├── index.html
├── manifest.json
└── sw.js
```
---

## 🛠️ Technologies Used

* **HTML5**
* **PWA Technologies:**
    * Service Workers
    * Web App Manifest

---

