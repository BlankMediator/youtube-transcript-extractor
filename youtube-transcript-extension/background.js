chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ytx-open-panel" });
  } catch {
    // The content script only runs on YouTube watch pages.
  }
});
