/**
 * MaalBot — Supabase auth + cloud sync helper (OPTIONAL, not wired in by default)
 * --------------------------------------------------------------------------------
 * Run schema.sql in your Supabase project first, then fill in the two
 * placeholders below. To actually use this, import it from app.js and
 * replace the relevant Storage.get/set calls — see the mapping at the
 * bottom of this file.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // safe to expose client-side (protected by RLS policies)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google' });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function fetchSessions(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertSession(userId, session) {
  const { error } = await supabase.from('sessions').upsert({
    id: session.id,
    user_id: userId,
    title: session.title,
    messages: session.messages,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function deleteSessionRemote(sessionId) {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/**
 * MAPPING (what to change in app.js once you wire this in):
 *   Storage.getJson('maalbot_conversations')  →  await fetchSessions(user.id)
 *   Storage.setJson('maalbot_conversations', sessions)  →  await upsertSession(user.id, changedSession)
 *   Local-only logout  →  await signOut()
 * Keep localStorage as an offline fallback/cache if you want the app to
 * still work without internet — sync to Supabase in the background.
 */
