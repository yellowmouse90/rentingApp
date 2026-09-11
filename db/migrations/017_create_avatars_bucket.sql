-- Profile photo upload: a public "avatars" bucket, one object per user under a
-- `${user_id}/...` prefix so storage.objects RLS can authorize writes without a join back to
-- `users_domain.profiles` (same shape Supabase's own docs recommend for user-owned avatars).
--
-- NOTE (see CLAUDE.md "Adding a brand-new schema..." for the same class of gotcha): on the
-- hosted project, buckets/policies created here take effect immediately since `storage` is
-- already an exposed/managed schema - no separate dashboard step is needed for this one, unlike
-- adding a new app schema to the Data API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
