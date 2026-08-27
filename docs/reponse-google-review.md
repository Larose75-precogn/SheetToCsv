# Brouillon de réponse à gwm-review@google.com

Objet : `Re: SheetToCsv (406510929267) - Google Workspace Marketplace Review`

> À envoyer **après** avoir déployé la nouvelle version du script et mis à jour la fiche
> (voir la checklist de `docs/MARKETPLACE_LISTING.md`, section 6).

---

Hello,

Thank you for the detailed feedback. All four points have been addressed.

**1. Trademark attribution.** Every mention of a Google product now carries the ™ symbol
(Google Sheets™, Google Drive™, Google Workspace™) in the store listing, in the app interface,
and on the privacy policy and terms of service pages. Each of these also carries the footnote:
"Google Sheets™, Google Drive™ and Google Workspace™ are trademarks of Google LLC. SheetToCsv
is an independent application, not affiliated with, endorsed or sponsored by Google LLC."

**2. Descriptions.** The short description now states in one sentence what the app does:
"Export every tab of a Google Sheets™ spreadsheet into a single CSV file." The detailed
description has been rewritten to describe only the app and its functionality — how it works
step by step, the feature list, and the two OAuth scopes it requests and why. It contains no
testimonials and no promotional claims.

**3. Icons.** A new icon has been produced as square PNGs with transparent backgrounds in
128×128, 96×96, 48×48 and 32×32. The same icon is now used in the store listing, on the OAuth
consent screen, and inside the app itself (side panel card header and web app header).

**4. The error you encountered.** Thank you for the screenshot — we were able to reproduce it.
The app requests only the per-file `drive.file` scope, which grants access to a spreadsheet
only after the user explicitly authorizes that file. The side panel card was attempting to
work with the active spreadsheet before that per-file authorization had been granted, which
produced the authorization error you saw. This has been fixed:

- the side panel now first shows an "Authorize this spreadsheet" button, which calls
  `CardService.newEditorFileScopeActionResponseBuilder().requestFileScopeForActiveDocument()`;
- once the user grants access to the open file, the card shows the "Convert this spreadsheet"
  button and the conversion runs correctly;
- an `onFileScopeGrantedTrigger` has been added to the manifest so the card refreshes
  automatically after the grant;
- the code no longer re-opens the active spreadsheet by ID (`SpreadsheetApp.openById`), which
  is not covered by the `drive.file` scope; it uses the active spreadsheet directly.

The app requests only two non-sensitive scopes:
`https://www.googleapis.com/auth/drive.file` and
`https://www.googleapis.com/auth/script.container.ui`. No sensitive or restricted scope is
used, and no spreadsheet data leaves the user's own Google account.

An updated end-to-end screen recording showing the new flow — install, per-file authorization,
conversion, CSV download — is available here: [LIEN VIDÉO À METTRE À JOUR]

No test credentials are required: the add-on runs entirely with the reviewer's own Google
account, and the test account gsmtestuser@marketplacetest.net needs no allowlisting.

Please let us know if anything else is needed.

Best regards,
Larose75
