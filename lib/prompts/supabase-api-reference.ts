/**
 * Concise Supabase API reference appended to the system prompt
 * when backend/auth is enabled. Keeps Gemini from hallucinating
 * API patterns while staying small enough (~2k tokens) to not
 * bloat the context.
 */

export const SUPABASE_API_REFERENCE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPABASE API QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use ONLY the patterns below when writing Supabase code. Do not guess or invent method names.

CLIENT CREATION:
  Browser (Client Components): import { createClient } from "@/lib/supabase/client"
    const supabase = createClient()
  Server (Server Components/Actions/Route Handlers): import { createClient } from "@/lib/supabase/server"
    const supabase = await createClient()   // MUST await — returns a promise

AUTH METHODS:
  const { data, error } = await supabase.auth.signUp({ email, password, options?: { data: { name }, emailRedirectTo } })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  const { error } = await supabase.auth.signOut()
  const { data: { user } } = await supabase.auth.getUser()   // ALWAYS use this for auth checks, NEVER getSession()
  const { data } = supabase.auth.onAuthStateChange((event, session) => { ... })  // client-side only
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

DATABASE — SELECT:
  const { data, error } = await supabase.from('table').select()                    // all rows
  const { data, error } = await supabase.from('table').select('id, name, col')     // specific columns
  const { data, error } = await supabase.from('table').select('*, comments(id, body)')  // join via FK
  const { data, error } = await supabase.from('table').select('*, profiles!inner(name)') // inner join
  const { count } = await supabase.from('table').select('*', { count: 'exact', head: true })  // count only

DATABASE — INSERT:
  const { error } = await supabase.from('table').insert({ col: 'value' })           // no return
  const { data, error } = await supabase.from('table').insert({ col: 'value' }).select()  // return inserted
  const { error } = await supabase.from('table').insert([{ col: 'a' }, { col: 'b' }])     // bulk

DATABASE — UPDATE:
  const { error } = await supabase.from('table').update({ col: 'new' }).eq('id', 1)
  const { data, error } = await supabase.from('table').update({ col: 'new' }).eq('id', 1).select()

DATABASE — DELETE:
  const { error } = await supabase.from('table').delete().eq('id', 1)                // MUST have filter
  const { data, error } = await supabase.from('table').delete().eq('id', 1).select()

DATABASE — UPSERT:
  const { data, error } = await supabase.from('table').upsert({ id: 1, col: 'val' }).select()
  const { data, error } = await supabase.from('table').upsert(rows, { onConflict: 'unique_col' }).select()

FILTERS (chain after .select()/.update()/.delete()):
  .eq('col', value)        .neq('col', value)       .gt('col', value)      .gte('col', value)
  .lt('col', value)        .lte('col', value)       .like('col', '%pat%')  .ilike('col', '%pat%')
  .is('col', null)         .in('col', [1, 2, 3])    .contains('col', ['a'])
  .or('col1.eq.val1,col2.eq.val2')                   .match({ col1: val1, col2: val2 })
  .not('col', 'is', null)
  .textSearch('col', "'eggs' & 'ham'", { config: 'english' })

MODIFIERS:
  .order('col', { ascending: false })    .limit(10)    .range(0, 9)
  .single()       // exactly 1 row or error
  .maybeSingle()  // 0 or 1 row (null if 0, no error)

STORAGE:
  await supabase.storage.from('bucket').upload('path/file.png', file, { contentType: 'image/png', upsert: false })
  await supabase.storage.from('bucket').download('path/file.png')
  supabase.storage.from('bucket').getPublicUrl('path/file.png')   // sync, returns { data: { publicUrl } }
  await supabase.storage.from('bucket').list('folder', { limit: 100 })
  await supabase.storage.from('bucket').remove(['path/file.png'])

REALTIME:
  const channel = supabase.channel('name')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => { ... })
    .subscribe()
  supabase.removeChannel(channel)

RLS POLICIES (in schema.sql):
  ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "name" ON tablename FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
  CREATE POLICY "name" ON tablename FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
  CREATE POLICY "name" ON tablename FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  CREATE POLICY "name" ON tablename FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
  -- Public read: CREATE POLICY "name" ON tablename FOR SELECT TO anon, authenticated USING (true);
  -- ALWAYS wrap auth.uid() in (SELECT auth.uid()) for performance.

CRITICAL RULES:
  1. NEVER use getSession() for server-side auth checks — ALWAYS use getUser() which validates the JWT.
  2. ALWAYS await createClient() on the server — it returns a Promise.
  3. insert/update/delete/upsert return NO DATA by default — chain .select() to get rows back.
  4. .single() throws if 0 rows match — use .maybeSingle() when the row might not exist.
  5. .delete() MUST have a filter — never call .delete() without .eq() or similar.
  6. Supabase returns max 1000 rows by default — use .range() for pagination.
  7. For joins: the FK must exist in schema.sql. PostgREST resolves joins via direct foreign keys only.
  8. Use !inner in select for inner joins: .select('*, other_table!inner(col)').
  9. Do NOT call other Supabase methods synchronously inside onAuthStateChange — wrap in setTimeout.
  10. createBrowserClient is for Client Components ONLY. createServerClient is for server contexts ONLY.
  11. After signInWithPassword() or signOut(), redirect with window.location.href (NOT router.push) to force a full page reload so server components re-render with the new session cookie.
  12. Auth-aware navbar MUST be a "use client" component using onAuthStateChange() + getUser() on mount. NEVER check auth only in a server component for nav UI — it won't update after login/logout without a full reload.
  13. Middleware setAll MUST create a NEW response from the updated request: response = NextResponse.next({ request }). Do NOT just set cookies on the old response — downstream server components won't see refreshed tokens.
  14. Initialize middleware response with NextResponse.next({ request }) — NOT NextResponse.next({ request: { headers: request.headers } }). Passing only headers loses cookie updates.
`;
