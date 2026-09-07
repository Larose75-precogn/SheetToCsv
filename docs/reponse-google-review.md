# Brouillon de réponse à gwm-review@google.com

Objet : `Re: SheetToCsv (406510929267) - Google Workspace Marketplace Review`

> À envoyer **après** avoir mis à jour la fiche (voir la checklist de
> `docs/MARKETPLACE_LISTING.md`, section 6).
> Le script est déployé : **version 27**, déploiement
> `AKfycbwAB9uJ17VdmnIuXV9Fc1ClORI4QWOe-hfYhUvjpGX36CZIrEEvL3-5OnocHtYEB75c`.

---

Hello,

Thank you for the detailed feedback. All points have been addressed.

**1. Trademark attribution.** Every mention of a Google product now carries the ™ symbol
(Google Sheets™, Google Drive™, Google Workspace™) in the store listing, in the app interface,
and on the privacy policy and terms of service pages. Each of these also carries the footnote:
"Google Sheets™, Google Drive™ and Google Workspace™ are trademarks of Google LLC. SheetToCsv
is an independent application, not affiliated with, endorsed or sponsored by Google LLC."

**2. Descriptions.** The short description now states in one sentence what the app does:
"Export every tab of a Google Sheets™ spreadsheet into a single CSV file." The detailed
description has been rewritten to describe only the app and its functionality — how it works
step by step, the feature list, and the OAuth scopes it requests and why. It contains no
testimonials and no promotional claims.

**3. Icons.** A new icon has been produced as square PNGs with transparent backgrounds in
128×128, 96×96, 48×48 and 32×32. The same icon is now used in the store listing, on the OAuth
consent screen, and inside the app itself (side panel card header and web app header). These
files are now served publicly at `https://addon.9l9.org/assets/icons/` — previously the
manifest `logoUrl` pointed at a URL that returned 404.

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

**5. Keeping the narrow scope everywhere.** The project also exposes a standalone web app,
which let the user pick a spreadsheet through Google Picker™ and then re-opened it with
`SpreadsheetApp.openById()` — an Apps Script call that requires the broad
`https://www.googleapis.com/auth/spreadsheets` scope. Rather than requesting that scope, that
conversion path has been withdrawn: the web app now directs the user to the add-on side panel,
which works on the active spreadsheet and needs no additional permission. The add-on itself is
unaffected.

**6. Consistency between the listing, the legal pages and the app.** The privacy policy and the
terms of service described a paid subscription handled by Stripe, an email address collected
for licence management, and a licence store. The published add-on implements none of this: it
is free, has no account, no payment path, and requests no email scope. Both pages have been
rewritten to describe the application as it actually behaves. They are live at
`https://addon.9l9.org/privacy.html` and `https://addon.9l9.org/terms.html`.

**Scopes requested.** The add-on requests two non-sensitive scopes:

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/drive.file` | per-file access to the single spreadsheet the user opens the add-on with, or designates in the Picker |
| `https://www.googleapis.com/auth/script.container.ui` | the add-on menu, side panel and dialogs inside Google Sheets™ |

No sensitive or restricted scope is requested, and the add-on makes no outbound HTTP request
at all. No spreadsheet
data leaves the user's own Google account: the conversion result is written to an `Export_CSV`
tab inside the user's own spreadsheet, and nothing is stored on our side.

An updated end-to-end screen recording showing the new flow — install, per-file authorization,
conversion, CSV download — is available here: [LIEN VIDÉO À METTRE À JOUR]

No test credentials are required: the add-on runs entirely with the reviewer's own Google
account, and the test account gsmtestuser@marketplacetest.net needs no allowlisting.

Please let us know if anything else is needed.

Best regards,
Larose75
