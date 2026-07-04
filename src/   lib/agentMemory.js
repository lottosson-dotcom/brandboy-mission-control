agentMemory.jsjs
import { supabase } from './supabaseClient'

export async function saveMemory(agentName, memoryType, content, tags = []) {
  const { data, error } = await supabase
    .from('agent_memory')
    .insert([{
      agent_name: agentName,
      memory_type: memoryType,
      content: content,
      tags: tags,
      session_id: new Date().toISOString().split('T')[0]
    }])
  
  if (error) console.error('Memory save error:', error)
  return { data, error }
}

export async function getMemories(agentName) {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('agent_name', agentName)
    .order('created_at', { ascending: false })
  
  if (error) console.error('Memory fetch error:', error)
  return { data, error }
}

export async function getAllMemories() {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) console.error('Memory fetch error:', error)
  return { data, error }
}

export async function searchMemories(keyword) {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('*')
    .ilike('content', `%${keyword}%`)
    .order('created_at', { ascending: false })
  
  if (error) console.error('Memory fetch error:', error)
  return { data, error }
}
