jsx
import { useState, useEffect } from 'react';
import { getActivityLog, logActivity, getAgentColor, timeAgo } from '../lib/activityLog';

const AGENTS = ['FORGE', 'SPARKY', 'REX', 'NOVA', 'PIXEL', 'SYSTEM'];

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ agent_name: 'SYSTEM', action: '', detail: '', client_project: '' });

  async function fetchLogs() {
    setLoading(true);
    const data = await getActivityLog(100);
    setLogs(data);
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, []);

  async function handleManualLog() {
    if (!manual.action) return;
    await logActivity(manual);
    setManual({ agent_name: 'SYSTEM', action: '', detail: '', client_project: '' });
    setShowManual(false);
    fetchLogs();
  }

  const filtered = logs.filter(log => {
    const matchAgent = filter === 'ALL' || log.agent_name === filter;
    const matchSearch = log.action?.toLowerCase().includes(search.toLowerCase()) || log.detail?.toLowerCase().includes(search.toLowerCase()) || log.client_project?.toLowerCase().includes(search.toLowerCase());
    return matchAgent && matchSearch;
  });

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', padding: '24px', color: 'white', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>🔴 ACTIVITY LOG</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchLogs} style={{ background: '#1f2937', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>↻ Refresh</button>
          <button onClick={() => setShowManual(!showManual)} style={{ background: '#f97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>+ Log Entry</button>
        </div>
      </div>
      {showManual && (
        <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px', color: '#f97316' }}>Manual Log Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <select value={manual.agent_name} onChange={e => setManual({ ...manual, agent_name: e.target.value })} style={{ background: '#111827', color: 'white', border: '1px solid #374151', padding: '8px', borderRadius: '6px' }}>
              {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input placeholder="Client / Project" value={manual.client_project} onChange={e => setManual({ ...manual, client_project: e.target.value })} style={{ background: '#111827', color: 'white', border: '1px solid #374151', padding
: '8px', borderRadius: '6px' }} />
            <input placeholder="Action (required)" value={manual.action} onChange={e => setManual({ ...manual, action: e.target.value })} style={{ background: '#111827', color: 'white', border: '1px solid #374151', padding: '8px', borderRadius: '6px' }} />
            <input placeholder="Detail" value={manual.detail} onChange={e => setManual({ ...manual, detail: e.target.value })} style={{ background: '#111827', color: 'white', border: '1px solid #374151', padding: '8px', borderRadius: '6px' }} />
          </div>
          <button onClick={handleManualLog} style={{ background: '#f97316', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer' }}>Save Entry</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('ALL')} style={{ background: filter === 'ALL' ? '#f97316' : '#1f2937', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>ALL</button>
        {AGENTS.map(a => (
          <button key={a} onClick={() => setFilter(a)} style={{ background: filter === a ? getAgentColor(a) : '#1f2937', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>{a}</button>
        ))}
      </div>
      <input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: '#1f2937', color: 'white', border: '1px solid #374151', padding: '10px', borderRadius: '6px', marginBottom: '24px', boxSizing: 'border-box' }} />
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No activity found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(log => (
            <div key={log.id} style={{ background: '#111827', borderLeft: `4px solid ${log.color || '#6b7280'}`, padding: '12px 16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: log.color || '#6b7280', fontWeight: 'bold', marginRight: '12px' }}>{log.agent_name}</span>
                <span style={{ color: '#f3f4f6', marginRight: '12px' }}>{log.action}</span>
                {log.client_project && <span style={{ color: '#9ca3af', marginRight: '12px' }}>— {log.client_project}</span>}
                {log.detail && <span style={{ color: '#6b7280' }}>{log.detail}</span>}
              </div>
              <span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' }}>{timeAgo(log.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
