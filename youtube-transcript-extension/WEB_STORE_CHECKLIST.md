# Chrome Web Store Checklist

- Create or use a Chrome Web Store developer account.
- Zip the extension with `package-extension.ps1`.
- Upload the zip in the Chrome Developer Dashboard.
- Complete the store listing using `STORE_LISTING.md`.
- Upload store graphics and screenshots.
- Fill out the privacy section using `PRIVACY.md`.
- Declare the single purpose: extracting transcript rows rendered on YouTube pages.
- Explain permissions:
  - `activeTab`: activate the transcript panel on the current YouTube video tab after a user click.
  - `scripting`: inject local extension UI files into the current YouTube video tab after a user click.
  - `storage`: remember the user's preferred floating button position.
- Add reviewer test instructions from `STORE_LISTING.md`.
- Submit for review.

Official references:

- https://developer.chrome.com/docs/webstore/publish
- https://developer.chrome.com/docs/extensions/reference/manifest/icons
