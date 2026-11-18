# Proposed database schema

This is a planning document. No database connection or model is implemented yet.

## Initial collections

- `users`: normalized email, password hash, roles, account status, locale, timestamps
- `authorProfiles`: user reference, public slug, biography, social links, approval status
- `books`: author reference, title/translations, description, language, category, price, cover/file references, publication status
- `chapters`: book reference, ordering, content/file reference, preview flag
- `orders`: reader reference, line items, currency, totals, order state, provider reference
- `payments`: order reference, provider IDs, status, verified webhook metadata
- `royaltyLedgerEntries`: order/item reference, author reference, signed amount, entry type, immutable source reference
- `reviews`: reader and book references, rating, text, moderation status

## Data rules

Use indexed normalized identifiers for login and author slugs. Keep private book files outside the public database and store only storage metadata. Never calculate financial history from a mutable balance field; derive it from ledger entries. Add schema validation, unique constraints, access rules, and retention decisions before launch.
