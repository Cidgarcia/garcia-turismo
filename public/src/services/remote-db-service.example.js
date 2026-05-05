
// Exemplo de camada para persistir em um banco real.
// Preencha com suas credenciais e mova as operações sensíveis para backend/serverless.

export async function saveSnapshotToSupabase(supabaseClient, payload) {
  return supabaseClient.from('finance_snapshots').insert({
    payload,
    created_at: new Date().toISOString()
  });
}

export async function loadLatestSnapshotFromSupabase(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('finance_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.payload ?? null;
}
