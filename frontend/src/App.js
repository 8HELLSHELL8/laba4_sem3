import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import AuthPage from './pages/AuthPage';
import NotFound from './pages/NotFound';
import Detail from './pages/Detail';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Form from './pages/Form';
import Home from './pages/Home';
import './css/App.css';

const ProtectedRoute = ({ isAuthenticated, isLoading, children }) => {
  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const checkInitialAuth = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/api/protected', {
          withCredentials: true,
        });
        console.log("User is authenticated:", response.data);
        setIsAuthenticated(true); 
      } catch (error) {
        console.error("Auth check failed:", error.response?.data || error.message);
        setIsAuthenticated(false); 
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated === null) {
      checkInitialAuth();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]); 

  const handleAuthChange = (status) => {
    setIsAuthenticated(status);
    console.log("Auth state updated:", status);
  };

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          isLoading ? (
            <p>Loading...</p>
          ) : isAuthenticated ? (
            <Navigate to="/home" replace />
          ) : (
            <AuthPage updateAuthState={handleAuthChange} />
          )
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <Layout handleLogout={() => handleAuthChange(false)} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="profile" element={<Profile />} />
        <Route path="add" element={<Form />} />
        <Route path="detail/:id" element={<Detail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;