# Choros

Choros is a premium, minimalist offline music player built using **Tauri v2**, **Rust**, **React**, **TypeScript**, and **Tailwind CSS**. It is designed with visual excellence, keyboard-driven navigation, and high performance in mind.

---

## 📐 Layout Architecture

The application adopts a clean, borderless **3-column design**:

*   **Left Column (Sidebar)**: Icon-based navigation panel linking all library views. Also houses settings access and directory scanning control at the bottom.
*   **Center Column (Content/Library)**: Dynamically renders the active tab. Displays custom slide-up bottom sheets for **Queue** management and **Playlist Picker**.
*   **Right Column (Player)**: Displays high-resolution album art, track details, progress seeker, volume control, action buttons, and a togglable overlay for embedded lyrics.

---

## ✨ Features

-   **Metadata & Embedded Lyrics**: Extracts metadata tags (`ID3`, `Vorbis`, `MP4`) using `lofty` in the Rust backend. Clicking the player cover art dynamically toggles and renders embedded `USLT` or `LYRICS` text.
-   **Local HTTP Streaming**: Serves files and album art directly via a custom low-overhead TCP server written in Rust, avoiding heavy base64 data overhead and enabling fast seek ranges.
-   **Smart Image Caching**: Remembers cover art locations locally in memory to prevent visual flickering and layout jumps when scrolling library lists.
-   **Folders View**: An interactive, nested tree directory viewer built from library files, mapping folders on disk to responsive inline list menus.
-   **Favourites**: القلب/Hearts persist track configurations across sessions via a secure local `favourites.json` data file.
-   **YT Music Style Details**: Drill-down menus for Albums, Artists, and Playlists feature large blurred hero banners, track counts, and numbered lists.

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Space` | Toggle Play / Pause |
| `Arrow Left` / `Right` | Seek backward / forward 5 seconds |
| `Arrow Up` / `Down` | Increase / decrease volume by 5% |
| `M` | Mute / Unmute audio |
| `S` | Toggle Shuffle |
| `R` | Toggle Repeat modes (None -> All -> One) |

---

## 🚀 Development & Building

Ensure you have the Rust toolchain and Node dependencies installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
```bash
npm run tauri dev
```

### 3. Build Production Executable
```bash
npx tauri build
```
The compiled Linux application binary will be written to `src-tauri/target/release/app`.
