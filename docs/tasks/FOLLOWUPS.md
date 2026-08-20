# Follow-ups — noted, fix later

Small fixes/enhancements captured mid-work. Not blocking; pick up when convenient.

_(none open)_

## Done

### Withdrawn-consent notification opens the image dialog ✅
A `media_consent_withdrawn` notification now links to
`/admin/assets?highlight=<client_media_id>`, and `highlight` **auto-opens** that
image's asset dialog (previously it only scrolled + ringed the card). The admin
lands straight on the per-purpose state, the "Confirm taken down" action, and the
usage manager (where it's used).
- [notifications/page.tsx](../../src/app/admin/notifications/page.tsx) — `hrefFor(n)`
- [asset-hub-tabs.tsx](../../src/components/admin/asset-hub-tabs.tsx) → [hub-asset-card.tsx](../../src/components/admin/hub-asset-card.tsx) — `autoOpen` prop
