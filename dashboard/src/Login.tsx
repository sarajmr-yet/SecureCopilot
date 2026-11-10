import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Identifiants incorrects');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d2137 0%, #1F4E79 60%, #2E75B6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Segoe UI, sans-serif'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '40px', width: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
          src="/logo.png" 
          alt="SecureCopilot Logo" 
          style={{ width: '80px', marginBottom: '8px' }}
          />
          <h1 style={{ margin: 0, color: '#1F4E79', fontSize: '24px', fontWeight: '800' }}>
            SecureCopilot
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '13px' }}>
            AI-Powered DevSecOps Toolchain
          </p>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }}>
            Nom d'utilisateur
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Entrez votre nom d'utilisateur"
            style={{
              width: '100%', padding: '12px', borderRadius: '8px',
              border: '2px solid #e9ecef', fontSize: '14px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border 0.2s'
            }}
            onFocus={e => e.target.style.border = '2px solid #1F4E79'}
            onBlur={e => e.target.style.border = '2px solid #e9ecef'}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '6px' }}>
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px',
              border: '2px solid #e9ecef', fontSize: '14px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border 0.2s'
            }}
            onFocus={e => e.target.style.border = '2px solid #1F4E79'}
            onBlur={e => e.target.style.border = '2px solid #e9ecef'}
          />
        </div>

        {error && (
          <div style={{
            background: '#fdecea', color: '#dc3545',
            padding: '10px 14px', borderRadius: '8px',
            fontSize: '13px', marginBottom: '16px',
            border: '1px solid #f5c6cb'
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: loading ? '#888' : 'linear-gradient(135deg, #1F4E79, #2E75B6)',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s'
          }}
        >
          {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#aaa' }}>
          SecureCopilot v2.0 — PFA 2025/2026
        </div>
      </div>
    </div>
  );
}