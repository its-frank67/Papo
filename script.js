const REPO_OWNER = "CoolDude2349";
const REPO_NAME = "Offline-HTML-Games-Pack";
const COMMIT_HASH = "67cb0723e2dd8e723e3ecda3ba40727656bc4a05";
const FOLDER_PATH = "offline";

const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FOLDER_PATH}?ref=${COMMIT_HASH}`;
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${COMMIT_HASH}/${FOLDER_PATH}/`;
const CACHE_NAME = "offline-html-game-active-cache-v1";

const gameListEl = document.getElementById("game-list");
const gameFrame = document.getElementById("game-frame");
const gameContainer = document.getElementById("game-container");
const statusOverlay = document.getElementById("status-overlay");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const downloadBtn = document.getElementById("download-btn");
const downloadLabel = document.getElementById("download-label");

let currentBlobUrl = null;
let currentGameFileName = null;

// 1. Fetch the list of games from the GitHub repository permalink
async function loadGameList() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();
    const htmlGames = files.filter(
      (file) => file.type === "file" && file.name.toLowerCase().endsWith(".html")
    );

    gameListEl.innerHTML = "";

    htmlGames.forEach((file) => {
      const displayName = file.name.replace(/\.html$/i, "");
      const btn = document.createElement("button");
      btn.className = "game-item";
      btn.textContent = displayName;

      btn.addEventListener("click", () => {
        document.querySelectorAll(".game-item").forEach((el) => el.classList.remove("active"));
        btn.classList.add("active");
        cacheAndRunGame(file.name, displayName);
      });

      gameListEl.appendChild(btn);
    });
  } catch (error) {
    gameListEl.innerHTML = `<div class="loading-item">Error loading games: ${error.message}</div>`;
  }
}

// 2. Patch/Fetch the selected game into the browser Cache and run it in the top-left screen
async function cacheAndRunGame(fileName, displayName) {
  statusOverlay.textContent = `Caching ${displayName}...`;
  statusOverlay.classList.remove("hidden");
  downloadBtn.disabled = true;

  // Clear previous frame before loading new cached game
  gameFrame.removeAttribute("srcdoc");
  gameFrame.src = "about:blank";

  const rawGameUrl = `${RAW_BASE_URL}${encodeURIComponent(fileName)}`;

  try {
    let htmlText = "";

    // Use browser Cache Storage API when served over HTTPS (e.g., GitHub Pages)
    if ("caches" in window) {
      const cache = await caches.open(CACHE_NAME);
      // Clear out previously cached game so only the active game is held in cache
      const keys = await cache.keys();
      await Promise.all(keys.map((key) => cache.delete(key)));

      const networkResponse = await fetch(rawGameUrl, { cache: "reload" });
      if (!networkResponse.ok) {
        throw new Error(`Failed to fetch game (${networkResponse.status})`);
      }

      await cache.put(rawGameUrl, networkResponse.clone());
      const cachedResponse = await cache.match(rawGameUrl);
      htmlText = await cachedResponse.text();
    } else {
      // Fallback if opened locally via file:// protocol
      const response = await fetch(rawGameUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch game (${response.status})`);
      }
      htmlText = await response.text();
    }

    // Revoke previous Blob URL if one exists
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
    }

    // Create a downloadable Blob from the cached game HTML
    const blob = new Blob([htmlText], { type: "text/html" });
    currentBlobUrl = URL.createObjectURL(blob);
    currentGameFileName = fileName;

    // Run the cached game inside the top-left iframe
    gameFrame.srcdoc = htmlText;
    statusOverlay.classList.add("hidden");

    // Enable the bottom-left download button for the currently cached game
    downloadBtn.disabled = false;
    downloadLabel.textContent = `Download ${displayName}`;
  } catch (error) {
    statusOverlay.textContent = `Failed to load ${displayName}: ${error.message}`;
  }
}

// 3. Download the currently cached game when clicking the bottom-left button
downloadBtn.addEventListener("click", () => {
  if (!currentBlobUrl || !currentGameFileName) return;

  const tempLink = document.createElement("a");
  tempLink.href = currentBlobUrl;
  tempLink.download = currentGameFileName;
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
});

// 4. Toggle Fullscreen on the top-left game screen
fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    gameContainer.requestFullscreen().catch((err) => {
      console.error("Fullscreen failed:", err);
    });
  } else {
    document.exitFullscreen();
  }
});

// Initialize on page load
loadGameList();
