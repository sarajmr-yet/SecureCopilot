import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, API_URL } from './AuthContext';
import Login from './Login';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc3545',
  HIGH: '#fd7e14',
  MEDIUM: '#ffc107'
};

function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('ALL');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'developer' });
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [assignData, setAssignData] = useState({ user_id: '', project_id: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject !== null) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const projectsRes = await axios.get(`${API_URL}/auth/projects`);
      setProjects(projectsRes.data);
      if (isAdmin) {
        const usersRes = await axios.get(`${API_URL}/auth/users`);
        setUsers(usersRes.data);
        const assignRes = await axios.get(`${API_URL}/auth/assignments`);
        setAssignments(assignRes.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const projectFilter = selectedProject ? `?project_id=${selectedProject}` : '?';
      const userFilter = !isAdmin && user?.id ? `&user_id=${user.id}` : '';

      const [statsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/stats${projectFilter}${userFilter}`),
        axios.get(`${API_URL}/history${projectFilter}${userFilter}`),
      ]);
      setStats(statsRes.data);
      setHistory(historyRes.data.history);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createUser = async () => {
    try {
      await axios.post(`${API_URL}/auth/users`, newUser);
      setMessage('✅ Utilisateur créé !');
      setNewUser({ username: '', email: '', password: '', role: 'developer' });
      fetchProjects();
    } catch { setMessage('❌ Erreur création utilisateur'); }
  };

  const createProject = async () => {
    try {
      await axios.post(`${API_URL}/auth/projects`, newProject);
      setMessage('✅ Projet créé !');
      setNewProject({ name: '', description: '' });
      fetchProjects();
    } catch { setMessage('❌ Erreur création projet'); }
  };

  const assignUser = async () => {
    try {
      await axios.post(`${API_URL}/auth/assign`, {
        user_id: parseInt(assignData.user_id),
        project_id: parseInt(assignData.project_id)
      });
      setMessage('✅ Utilisateur assigné !');
      fetchProjects();
    } catch { setMessage('❌ Erreur assignation'); }
  };

  const removeAssignment = async (user_id: number, project_id: number) => {
    try {
      await axios.delete(`${API_URL}/auth/assign`, {
        data: { user_id, project_id }
      });
      setMessage('✅ Assignation supprimée !');
      fetchProjects();
    } catch { setMessage('❌ Erreur suppression'); }
  };
  const markAsFixed = async (vuln_id: number) => {
    try {
        await axios.patch(`${API_URL}/vulnerabilities/${vuln_id}/fix`);
        setMessage('✅ Vulnérabilité marquée comme corrigée !');
        fetchData();
    } catch {
        setMessage('❌ Erreur');
    }
};
  const score = stats ? Math.max(0, 100 - (stats.critical * 15) - (stats.high * 8) - (stats.medium * 3)) : 0;
  const scoreColor = score >= 80 ? '#28a745' : score >= 60 ? '#ffc107' : score >= 40 ? '#fd7e14' : '#dc3545';
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Acceptable' : score >= 40 ? 'Risqué' : 'Critique';

  const pieData = stats ? [
    { name: 'Critical', value: stats.critical, color: '#dc3545' },
    { name: 'High', value: stats.high, color: '#fd7e14' },
    { name: 'Medium', value: stats.medium, color: '#ffc107' },
  ].filter(d => d.value > 0) : [];

  const barData = stats ? [
    { name: 'Critical', count: stats.critical },
    { name: 'High', count: stats.high },
    { name: 'Medium', count: stats.medium },
    { name: 'Fixed', count: stats.fixed },
  ] : [];

  const filteredHistory = filter === 'ALL' ? history : history.filter(v => v.severity === filter);
  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || '';

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '2px solid #e9ecef', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box' as const,
    marginBottom: '10px', fontFamily: 'Segoe UI, sans-serif'
  };

  const btnStyle = (color: string) => ({
    padding: '10px 20px', background: color, color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: '700' as const, width: '100%'
  });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '64px' }}>🔐</div>
        <p style={{ color: '#1F4E79', fontWeight: 'bold' }}>Chargement...</p>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#f0f2f5', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d2137, #1F4E79, #2E75B6)',
        color: 'white', padding: '16px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <img src="/logo.png" alt="logo" style={{ width: '32px', height: '32px' }} />
    SecureCopilot Dashboard
</h1>
          <p style={{ margin: '2px 0 0', opacity: 0.7, fontSize: '12px' }}>AI-Powered DevSecOps Toolchain</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {selectedProject && (
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 20px', textAlign: 'center', border: `2px solid ${scoreColor}` }}>
              <div style={{ fontSize: '28px', fontWeight: '900', color: scoreColor }}>{score}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>Score / 100</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: scoreColor }}>{scoreLabel}</div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>
              👤 {user?.username}
              <span style={{
                marginLeft: '8px', padding: '2px 8px', borderRadius: '12px',
                background: isAdmin ? '#dc3545' : '#28a745', fontSize: '11px'
              }}>
                {isAdmin ? 'ADMIN' : 'DEV'}
              </span>
            </div>
            {selectedProject && (
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                ↻ {lastUpdate.toLocaleTimeString('fr-FR')}
              </div>
            )}
            <button onClick={logout} style={{
              marginTop: '6px', padding: '4px 12px', background: 'rgba(255,255,255,0.2)',
              color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
            }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ background: 'white', borderBottom: '1px solid #e9ecef', padding: '0 32px' }}>
        {['overview', 'history', ...(isAdmin ? ['admin'] : [])].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            color: activeTab === tab ? '#1F4E79' : '#888',
            borderBottom: activeTab === tab ? '3px solid #1F4E79' : '3px solid transparent'
          }}>
            {tab === 'overview' ? '📊 Vue d\'ensemble' : tab === 'history' ? '📋 Historique' : '⚙️ Administration'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {!selectedProject ? (
              <div style={{
                background: 'white', borderRadius: '16px', padding: '48px',
                textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>📁</div>
                <h2 style={{ color: '#1F4E79', marginBottom: '8px', fontSize: '22px' }}>
                  Sélectionnez un projet
                </h2>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>
                  Choisissez un projet pour visualiser ses vulnérabilités
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
                  {projects.map(p => (
                    <div key={p.id}
                      onClick={() => setSelectedProject(p.id)}
                      style={{
                        background: '#f8f9fa', borderRadius: '12px', padding: '24px',
                        cursor: 'pointer', borderLeft: '4px solid #1F4E79',
                        transition: 'all 0.2s', textAlign: 'left',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e8f0fe'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f8f9fa'}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                      <div style={{ fontWeight: '700', color: '#1F4E79', fontSize: '15px' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{p.description || 'Aucune description'}</div>
                      <div style={{ marginTop: '12px', fontSize: '12px', color: '#2E75B6', fontWeight: '600' }}>
                        Voir les vulnérabilités →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#e8f0fe', borderRadius: '10px', padding: '12px 20px',
                  marginBottom: '16px', borderLeft: '4px solid #1F4E79'
                }}>
                  <span style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}
                    onClick={() => setSelectedProject(null)}>
                    📁 Tous les projets
                  </span>
                  <span style={{ color: '#888' }}>›</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1F4E79' }}>
                    📁 {selectedProjectName}
                  </span>
                  <button onClick={() => setSelectedProject(null)} style={{
                    marginLeft: 'auto', padding: '4px 12px', background: '#1F4E79',
                    color: 'white', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '12px'
                  }}>← Changer de projet</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  {[
                    { label: 'CRITICAL', value: stats?.critical, color: '#dc3545', bg: '#fff5f5', icon: '🔴' },
                    { label: 'HIGH', value: stats?.high, color: '#fd7e14', bg: '#fff9f5', icon: '🟠' },
                    { label: 'MEDIUM', value: stats?.medium, color: '#d4a017', bg: '#fffdf0', icon: '🟡' },
                    { label: 'CORRIGÉES', value: stats?.fixed, color: '#28a745', bg: '#f0faf4', icon: '✅' },
                  ].map((card, i) => (
                    <div key={i} style={{
                      background: card.bg, borderRadius: '12px', padding: '20px',
                      textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      borderTop: `4px solid ${card.color}`
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{card.icon}</div>
                      <div style={{ fontSize: '36px', fontWeight: '900', color: card.color }}>{card.value || 0}</div>
                      <div style={{ fontSize: '11px', color: '#888', fontWeight: '600', marginTop: '4px' }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}> Distribution</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {barData.map((_, i) => (
                            <Cell key={i} fill={['#dc3545', '#fd7e14', '#ffc107', '#28a745'][i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}> Répartition</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}>
                     Dernières détections — {selectedProjectName}
                    {!isAdmin && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>(vos vulnérabilités)</span>}
                  </h3>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
                      <p>Aucune vulnérabilité détectée pour ce projet</p>
                    </div>
                  ) : (
                    history.slice(0, 5).map((vuln, i) => (
                      <div key={vuln.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px', borderRadius: '8px',
                        background: i % 2 === 0 ? '#f8f9fa' : 'white', marginBottom: '4px'
                      }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                          background: SEVERITY_COLORS[vuln.severity] || '#6c757d',
                          color: vuln.severity === 'MEDIUM' ? '#333' : 'white',
                          minWidth: '65px', textAlign: 'center'
                        }}>{vuln.severity}</span>
                        <span style={{ fontWeight: '600', fontSize: '13px', flex: 1 }}>{vuln.vuln_id}</span>
                        {isAdmin && (
                          <span style={{ background: '#f0e6ff', color: '#6f42c1', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                            👤 {users.find((u: any) => u.id === vuln.user_id)?.username || 'inconnu'}
                          </span>
                        )}
                        <span style={{ background: '#e8f0fe', color: '#1F4E79', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          📁 {selectedProjectName}
                        </span>
                        <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                          {vuln.file_path?.split('\\').pop()}
                        </span>
                        <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                          {vuln.cwe}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* HISTORIQUE */}
        {activeTab === 'history' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {!selectedProject ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
                <p style={{ fontSize: '15px' }}>Sélectionnez un projet dans Vue d'ensemble pour voir l'historique</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#1F4E79', fontSize: '14px', fontWeight: '700' }}>
                    📋 Historique — {selectedProjectName} ({filteredHistory.length})
                    {!isAdmin && <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>(vos vulnérabilités)</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(f => (
                      <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '5px 14px', borderRadius: '20px', border: 'none',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                        background: filter === f ? '#1F4E79' : '#f0f2f5',
                        color: filter === f ? 'white' : '#666'
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#1F4E79', color: 'white' }}>
                      {['ID', 'Projet', 'Fichier', 'Ligne', 'Type', 'Sévérité', 'CWE',
                        ...(isAdmin ? ['Développeur'] : []), 'Date', 'Statut'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((vuln, i) => (
                      <tr key={vuln.id} style={{ background: i % 2 === 0 ? '#f8f9fa' : 'white' }}>
                        <td style={{ padding: '10px 12px', color: '#888' }}>#{vuln.id}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#e8f0fe', color: '#1F4E79', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                            📁 {selectedProjectName}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}>
                          {vuln.file_path?.split('\\').pop() || 'unknown'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#1F4E79', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            L.{vuln.line_number}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{vuln.vuln_id}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                            background: SEVERITY_COLORS[vuln.severity] || '#6c757d',
                            color: vuln.severity === 'MEDIUM' ? '#333' : 'white'
                          }}>{vuln.severity}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            {vuln.cwe}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              background: '#f0e6ff', color: '#6f42c1',
                              padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600'
                            }}>
                              👤 {users.find((u: any) => u.id === vuln.user_id)?.username || 'inconnu'}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#666' }}>
                          {new Date(vuln.detected_at).toLocaleString('fr-FR')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
  {vuln.is_fixed ? (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      background: '#d4edda', color: '#155724'
    }}>
      ✅ Corrigé
    </span>
  ) : isAdmin ? (
    <span style={{
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      background: '#fdecea', color: '#721c24'
    }}>
      ⚠️ En attente
    </span>
  ) : (
    <button
      onClick={() => markAsFixed(vuln.id)}
      style={{
        padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
        fontWeight: '600', background: '#fdecea', color: '#721c24',
        border: '1px solid #f5c6cb', cursor: 'pointer'
      }}
    >
      ⚠️ Marquer corrigé
    </button>
  )}
</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ADMIN */}
        {activeTab === 'admin' && isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}>👤 Créer un utilisateur</h3>
              <input style={inputStyle} placeholder="Nom d'utilisateur" value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
              <input style={inputStyle} placeholder="Email" value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              <input style={inputStyle} type="password" placeholder="Mot de passe" value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                <option value="developer">Developer</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={createUser} style={btnStyle('#1F4E79')}>➕ Créer</button>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}>📁 Créer un projet</h3>
              <input style={inputStyle} placeholder="Nom du projet" value={newProject.name}
                onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
              <input style={inputStyle} placeholder="Description" value={newProject.description}
                onChange={e => setNewProject({ ...newProject, description: e.target.value })} />
              <button onClick={createProject} style={btnStyle('#28a745')}>➕ Créer</button>

              <h3 style={{ margin: '20px 0 12px', color: '#1F4E79', fontSize: '14px' }}>🔗 Assigner</h3>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={assignData.user_id}
                onChange={e => setAssignData({ ...assignData, user_id: e.target.value })}>
                <option value="">-- Choisir utilisateur --</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
              </select>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={assignData.project_id}
                onChange={e => setAssignData({ ...assignData, project_id: e.target.value })}>
                <option value="">-- Choisir projet --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={assignUser} style={btnStyle('#fd7e14')}>🔗 Assigner</button>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}>👥 Utilisateurs ({users.length})</h3>
              {users.map((u, i) => (
                <div key={u.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px', borderRadius: '8px',
                  background: i % 2 === 0 ? '#f8f9fa' : 'white', marginBottom: '4px'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>👤 {u.username}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{u.email}</div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                    background: u.role === 'admin' ? '#dc3545' : '#28a745', color: 'white'
                  }}>{u.role}</span>
                </div>
              ))}
            </div>

            {/* Équipe & Projets */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              gridColumn: '1 / -1'
            }}>
              <h3 style={{ margin: '0 0 16px', color: '#1F4E79', fontSize: '14px' }}>
                🗂️ Équipe & Projets
              </h3>
              {users.filter(u => u.role === 'developer').map((u: any) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '8px',
                  background: '#f8f9fa', marginBottom: '8px'
                }}>
                  <span style={{ fontWeight: '700', color: '#1F4E79', minWidth: '100px' }}>
                    👤 {u.username}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                    {assignments
                      .filter((a: any) => a.user_id === u.id)
                      .map((a: any) => (
                        <span key={a.project_id} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: '#e8f0fe', color: '#1F4E79',
                          padding: '4px 10px', borderRadius: '20px', fontSize: '12px'
                        }}>
                          📁 {a.project_name}
                          <button
                            onClick={() => removeAssignment(u.id, a.project_id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#dc3545', fontWeight: '700', fontSize: '14px',
                              padding: '0 2px', lineHeight: 1
                            }}
                          >×</button>
                        </span>
                      ))}
                    {assignments.filter((a: any) => a.user_id === u.id).length === 0 && (
                      <span style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>
                        Aucun projet assigné
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {message && (
          <div style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: message.includes('✅') ? '#d4edda' : '#fdecea',
            color: message.includes('✅') ? '#155724' : '#721c24',
            padding: '12px 20px', borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '14px', fontWeight: '600'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Login />;
}

export default App;