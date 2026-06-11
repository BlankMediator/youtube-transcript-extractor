import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_")
    return value or "youtube_transcript"


def video_id_from_url(url: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})", url)
    return match.group(1) if match else "video"


def open_transcript_panel(page: Page) -> None:
    page.wait_for_timeout(2_000)

    more = page.get_by_role("button", name="...more")
    if more.count() == 1:
        more.click()
        page.wait_for_timeout(1_000)

    for _ in range(3):
        if page.locator("ytd-transcript-segment-renderer").count() > 0:
            return

        show_transcript = page.get_by_role("button", name="Show transcript")
        if show_transcript.count() == 1:
            show_transcript.click()
            page.wait_for_timeout(3_000)
            continue

        close_transcript = page.get_by_role("button", name="Close transcript")
        if close_transcript.count() == 1:
            page.wait_for_timeout(2_000)
            if page.locator("ytd-transcript-segment-renderer").count() > 0:
                return
            close_transcript.click()
            page.wait_for_timeout(1_000)
            show_transcript = page.get_by_role("button", name="Show transcript")
            if show_transcript.count() == 1:
                show_transcript.click()
                page.wait_for_timeout(3_000)
                continue

        page.reload(wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(2_000)


def read_transcript_rows(page: Page) -> list[dict[str, str]]:
    # YouTube virtualizes transcript rows, so scroll the transcript panel until all rows load.
    previous_count = -1
    stable_rounds = 0
    while stable_rounds < 4:
        count = page.locator("ytd-transcript-segment-renderer").count()
        stable_rounds = stable_rounds + 1 if count == previous_count else 0
        previous_count = count
        page.evaluate(
            """
            () => {
              const list = document.querySelector('ytd-transcript-segment-list-renderer');
              const scroller = list?.closest('ytd-engagement-panel-section-list-renderer')
                || list?.parentElement
                || document.scrollingElement;
              if (scroller) scroller.scrollTop = scroller.scrollHeight;
            }
            """
        )
        page.wait_for_timeout(700)

    return page.evaluate(
        """
        () => Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'))
          .map((row) => {
            const timestamp = row.querySelector('.segment-timestamp')?.textContent?.trim() || '';
            const text = row.querySelector('.segment-text')?.textContent
              ?.replace(/\\s+/g, ' ')
              ?.trim() || '';
            return { timestamp, text };
          })
          .filter((row) => row.text)
        """
    )


def transcript_diagnostics(page: Page) -> str:
    return page.evaluate(
        """
        () => {
          const hasMore = [...document.querySelectorAll('button')]
            .some((button) => button.innerText.trim() === '...more');
          const hasShow = [...document.querySelectorAll('button')]
            .some((button) => button.innerText.trim() === 'Show transcript');
          const hasClose = [...document.querySelectorAll('button')]
            .some((button) => button.getAttribute('aria-label') === 'Close transcript');
          const subtitleButton = [...document.querySelectorAll('button')]
            .map((button) => button.getAttribute('aria-label') || '')
            .find((label) => label.toLowerCase().includes('subtitle')
              || label.toLowerCase().includes('caption')) || '';
          return JSON.stringify({ hasMore, hasShow, hasClose, subtitleButton });
        }
        """
    )


def extract_transcript(
    url: str,
    browser_name: str = "chrome",
    headless: bool = False,
    cdp_url: str | None = None,
    user_data_dir: str | None = None,
    profile_directory: str | None = None,
    manual: bool = False,
) -> list[dict[str, str]]:
    with sync_playwright() as p:
        browser_type = p.firefox if browser_name == "firefox" else p.chromium
        channel = {
            "chrome": "chrome",
            "msedge": "msedge",
            "chromium": None,
            "firefox": None,
        }[browser_name]

        if cdp_url:
            if browser_name not in {"chrome", "msedge", "chromium"}:
                raise ValueError("--cdp-url is only supported for Chromium-based browsers.")
            browser = p.chromium.connect_over_cdp(cdp_url)
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = context.new_page()
            close_browser = True
        elif user_data_dir:
            args = []
            if profile_directory:
                args.append(f"--profile-directory={profile_directory}")
            launch_kwargs = {"headless": headless}
            if channel:
                launch_kwargs["channel"] = channel
            context = browser_type.launch_persistent_context(
                user_data_dir,
                args=args,
                **launch_kwargs,
            )
            browser = context
            page = context.new_page()
            close_browser = True
        else:
            launch_kwargs = {"headless": headless}
            if channel:
                launch_kwargs["channel"] = channel
            browser = browser_type.launch(**launch_kwargs)
            page = browser.new_page()
            close_browser = True

        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        if manual:
            print(
                "\nManual mode:\n"
                "1. Use the browser window that just opened.\n"
                "2. Sign in to YouTube if needed.\n"
                "3. Open the transcript until timestamped rows are visible.\n"
                "4. Come back here and press Enter.\n"
            )
            input("Press Enter after the transcript rows are visible...")
        else:
            open_transcript_panel(page)

        try:
            page.wait_for_selector(
                "ytd-transcript-segment-renderer",
                state="attached",
                timeout=10_000,
            )
        except Exception as exc:
            details = transcript_diagnostics(page)
            if close_browser:
                browser.close()
            raise RuntimeError(
                "Transcript rows did not load. This often happens when Playwright opens "
                "a fresh browser profile while your normal browser profile receives a "
                "different YouTube transcript experience. Diagnostics: " + details
            ) from exc

        rows = read_transcript_rows(page)
        if close_browser:
            browser.close()
        return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a YouTube transcript via the visible transcript panel.")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument(
        "--browser",
        choices=["chrome", "msedge", "chromium", "firefox"],
        default="chrome",
        help="Browser to use. Defaults to installed Google Chrome.",
    )
    parser.add_argument("--headless", action="store_true", help="Run browser headlessly")
    parser.add_argument(
        "--cdp-url",
        help="Attach to Chrome started with remote debugging, e.g. http://127.0.0.1:9222",
    )
    parser.add_argument(
        "--user-data-dir",
        help="Launch Chrome with this user data directory. Close Chrome first if using your real profile.",
    )
    parser.add_argument(
        "--profile-directory",
        help="Chrome profile directory to use with --user-data-dir, e.g. Default or Profile 1.",
    )
    parser.add_argument(
        "--manual",
        action="store_true",
        help="Pause so you can sign in or manually open the transcript before extraction.",
    )
    parser.add_argument("--out-dir", default=".", help="Output directory")
    args = parser.parse_args()

    rows = extract_transcript(
        args.url,
        browser_name=args.browser,
        headless=args.headless,
        cdp_url=args.cdp_url,
        user_data_dir=args.user_data_dir,
        profile_directory=args.profile_directory,
        manual=args.manual,
    )
    output_dir = Path(args.out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    base = output_dir / safe_name(video_id_from_url(args.url))
    txt_path = base.with_suffix(".txt")
    json_path = base.with_suffix(".json")

    txt_path.write_text(
        "\n".join(f"{row['timestamp']} {row['text']}" for row in rows),
        encoding="utf-8",
    )
    json_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Extracted {len(rows)} transcript rows")
    print(f"TXT:  {txt_path.resolve()}")
    print(f"JSON: {json_path.resolve()}")


if __name__ == "__main__":
    main()
