(() => {
  const rows = [...document.querySelectorAll("ytd-transcript-segment-renderer")]
    .map((row) => {
      const timestamp = row.querySelector(".segment-timestamp")?.textContent?.trim() || "";
      const text = row.querySelector(".segment-text")?.textContent?.replace(/\s+/g, " ")?.trim() || "";
      return { timestamp, text };
    })
    .filter((row) => row.text);

  if (!rows.length) {
    alert("No transcript rows found. Open the YouTube transcript panel first, then run this again.");
    return;
  }

  const videoId = new URL(location.href).searchParams.get("v") || "youtube";
  const txt = rows.map((row) => `${row.timestamp} ${row.text}`).join("\n");
  const json = JSON.stringify(rows, null, 2);

  const download = (name, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  download(`${videoId}.txt`, txt, "text/plain;charset=utf-8");
  download(`${videoId}.json`, json, "application/json;charset=utf-8");
  console.log(`Downloaded ${rows.length} transcript rows.`);
})();
