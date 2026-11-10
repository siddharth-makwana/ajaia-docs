import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EditorPage from './pages/EditorPage.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="center muted">Loading…</div>;

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, signOut }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/d/:id" element={user ? <EditorPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
