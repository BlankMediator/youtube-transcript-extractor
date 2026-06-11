(() => {
  const ROOT_ID = "yt-transcript-extractor-root";
  const PANEL_ID = "yt-transcript-extractor-panel";
  const LAUNCHER_POSITION_KEY = "ytTranscriptLauncherPosition";

  const state = {
    rows: [],
    text: "",
    includeTimestamps: true,
  };

  function getVideoId() {
    return new URL(location.href).searchParams.get("v") || "youtube";
  }

  function extractRows() {
    return [...document.querySelectorAll("ytd-transcript-segment-renderer")]
      .map((row) => {
        const timestamp = row.querySelector(".segment-timestamp")?.textContent?.trim() || "";
        const text = row.querySelector(".segment-text")?.textContent?.replace(/\s+/g, " ")?.trim() || "";
        return { timestamp, text };
      })
      .filter((row) => row.text);
  }

  function setStatus(message) {
    const status = document.querySelector("#yt-transcript-extractor-status");
    if (status) status.textContent = message;
  }

  function setOutput(rows) {
    state.rows = rows;
    state.text = formatRows(rows);

    const output = document.querySelector("#yt-transcript-extractor-output");
    const count = document.querySelector("#yt-transcript-extractor-count");
    if (output) output.value = state.text;
    if (count) count.textContent = `${rows.length} rows`;
    setStatus(rows.length ? "Transcript ready." : "No transcript rows found.");
  }

  function formatRows(rows) {
    return rows
      .map((row) => state.includeTimestamps ? `${row.timestamp} ${row.text}` : row.text)
      .join("\n");
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function findButtonByText(text) {
    return [...document.querySelectorAll("button")]
      .find((button) => button.innerText.trim() === text);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getStoredLauncherPosition(callback) {
    chrome.storage?.local?.get?.(LAUNCHER_POSITION_KEY, (result) => {
      callback(result?.[LAUNCHER_POSITION_KEY] || null);
    });
  }

  function saveLauncherPosition(position) {
    chrome.storage?.local?.set?.({ [LAUNCHER_POSITION_KEY]: position });
  }

  function applyLauncherPosition(root, position) {
    if (!position) return;

    const width = root.offsetWidth || 104;
    const height = root.offsetHeight || 38;
    const left = clamp(position.left, 8, window.innerWidth - width - 8);
    const top = clamp(position.top, 8, window.innerHeight - height - 8);

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  }

  function enableLauncherDrag(root) {
    const button = root.querySelector("button");
    let drag = null;

    root.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const rect = root.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false,
      };
      root.setPointerCapture(event.pointerId);
    });

    root.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;

      const deltaX = Math.abs(event.clientX - drag.startX);
      const deltaY = Math.abs(event.clientY - drag.startY);
      if (deltaX > 3 || deltaY > 3) drag.moved = true;
      if (!drag.moved) return;

      const width = root.offsetWidth;
      const height = root.offsetHeight;
      const left = clamp(event.clientX - drag.offsetX, 8, window.innerWidth - width - 8);
      const top = clamp(event.clientY - drag.offsetY, 8, window.innerHeight - height - 8);

      root.classList.add("ytx-dragging");
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
      event.preventDefault();
    });

    root.addEventListener("pointerup", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;

      root.releasePointerCapture(event.pointerId);
      root.classList.remove("ytx-dragging");

      if (drag.moved) {
        const rect = root.getBoundingClientRect();
        saveLauncherPosition({ left: Math.round(rect.left), top: Math.round(rect.top) });
        button.dataset.skipNextClick = "true";
      }

      drag = null;
    });

    button.addEventListener("click", (event) => {
      if (button.dataset.skipNextClick === "true") {
        delete button.dataset.skipNextClick;
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    window.addEventListener("resize", () => {
      const rect = root.getBoundingClientRect();
      applyLauncherPosition(root, { left: rect.left, top: rect.top });
    });
  }

  async function tryOpenTranscript() {
    setStatus("Looking for transcript controls...");

    const more = findButtonByText("...more");
    if (more) {
      more.click();
      await sleep(900);
    }

    let rows = extractRows();
    if (rows.length) {
      setOutput(rows);
      return;
    }

    const showTranscript = findButtonByText("Show transcript");
    if (showTranscript) {
      showTranscript.click();
      setStatus("Opening transcript...");
      await sleep(2500);
    }

    rows = extractRows();
    if (rows.length) {
      setOutput(rows);
      return;
    }

    setOutput([]);
    setStatus("No transcript rows found. Open the YouTube transcript panel manually, then click Extract.");
  }

  function ensurePanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="ytx-header">
        <strong>YouTube Transcript</strong>
        <span id="yt-transcript-extractor-count">0 rows</span>
        <button type="button" id="ytx-close" title="Close">x</button>
      </div>
      <div class="ytx-actions">
        <button type="button" id="ytx-open">Open Transcript</button>
        <button type="button" id="ytx-extract">Extract</button>
        <button type="button" id="ytx-copy">Copy</button>
        <button type="button" id="ytx-download-txt">TXT</button>
        <button type="button" id="ytx-download-json">JSON</button>
      </div>
      <label class="ytx-toggle">
        <input type="checkbox" id="ytx-timestamps" checked>
        <span>Include timestamps</span>
      </label>
      <p id="yt-transcript-extractor-status">Open the transcript, then extract.</p>
      <textarea id="yt-transcript-extractor-output" spellcheck="false"></textarea>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#ytx-close").addEventListener("click", () => panel.remove());
    panel.querySelector("#ytx-open").addEventListener("click", tryOpenTranscript);
    panel.querySelector("#ytx-extract").addEventListener("click", () => setOutput(extractRows()));
    panel.querySelector("#ytx-timestamps").addEventListener("change", (event) => {
      state.includeTimestamps = event.target.checked;
      state.text = formatRows(state.rows);
      panel.querySelector("#yt-transcript-extractor-output").value = state.text;
      setStatus(state.includeTimestamps ? "Timestamps included." : "Timestamps hidden.");
    });
    panel.querySelector("#ytx-copy").addEventListener("click", async () => {
      const output = panel.querySelector("#yt-transcript-extractor-output");
      await navigator.clipboard.writeText(output.value);
      setStatus("Copied transcript to clipboard.");
    });
    panel.querySelector("#ytx-download-txt").addEventListener("click", () => {
      if (!state.text) setOutput(extractRows());
      download(`${getVideoId()}.txt`, state.text, "text/plain;charset=utf-8");
      setStatus("Downloaded TXT.");
    });
    panel.querySelector("#ytx-download-json").addEventListener("click", () => {
      if (!state.rows.length) setOutput(extractRows());
      download(`${getVideoId()}.json`, JSON.stringify(state.rows, null, 2), "application/json;charset=utf-8");
      setStatus("Downloaded JSON.");
    });

    setOutput(extractRows());
  }

  function injectLauncher() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = '<button type="button" title="Drag to move. Click to extract YouTube transcript.">Transcript</button>';
    root.querySelector("button").addEventListener("click", ensurePanel);
    document.body.appendChild(root);
    getStoredLauncherPosition((position) => applyLauncherPosition(root, position));
    enableLauncherDrag(root);
  }

  injectLauncher();

  chrome.runtime?.onMessage?.addListener((message) => {
    if (message?.type === "ytx-open-panel") {
      ensurePanel();
    }
  });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      injectLauncher();
    }
  }, 1000);
})();
