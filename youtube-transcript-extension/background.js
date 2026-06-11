async function ensureInjected(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["styles.css"],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("https://www.youtube.com/watch")) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ytx-open-panel" });
  } catch {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "ytx-open-panel" });
  }
});
