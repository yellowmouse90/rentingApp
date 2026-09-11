-- Notifications (in-app, push, and email) were being rendered in the language of whoever
-- performed the triggering action (read from that request's own `pietro_language` cookie via
-- getServerLanguage()), not the recipient's own language - because no language preference was
-- ever persisted anywhere the server could look it up for a user other than the current
-- requester. Language choice lived only in the browser's localStorage/cookie (web) or
-- SharedPreferences (Flutter), both client-only.
--
-- Same shape as the existing `preferred_currency` column: a per-user setting the server can read
-- for any user, not just the one making the current request.
alter table users_domain.profiles
  add column preferred_language text not null default 'it'
    check (preferred_language in ('it', 'en'));
