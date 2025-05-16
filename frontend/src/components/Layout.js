import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../css/Layout.css';

function getCookie(name) {
    const cookieValue = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieValue ? cookieValue.pop() : '';
}

axios.interceptors.request.use((config) => {
  console.log('Request Headers:', config.headers);
  console.log('Cookies being sent:', document.cookie);
  return config;
}, (error) => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

axios.interceptors.response.use((response) => {
  console.log('Response Headers:', response.headers);
  console.log('Response Data:', response.data);
  return response;
}, (error) => {
  console.error('Response error:', error.response?.data || error.message);
  return Promise.reject(error);
});

const Layout = () => {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    setLoading(true);
    try {
      const csrfToken = getCookie('_csrfToken');
      if (!csrfToken) {
        console.error("CSRF token not found during user fetch.");
        setCurrentUser(null);
        return;
      }

      const response = await axios.get('http://localhost:5000/api/protected', {
        withCredentials: true,
        headers: {
          'x-csrf-token': csrfToken, 
        },
      });

      const userData = response.data.user ? {
        ...response.data.user,
        name: response.data.user.name || 'User'
      } : null;

      setCurrentUser(userData);
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        setCurrentUser(null);
      } else {
        console.error('Error fetching current user:', error);
        setCurrentUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const csrfToken = getCookie('_csrfToken');
      if (!csrfToken) {
        alert("CSRF token not found. Please refresh the page or try logging in again.");
        return;
      }

      await axios.post('http://localhost:5000/api/logout', {}, {
        withCredentials: true,
        headers: {
          'x-csrf-token': csrfToken, 
        },
      });
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error during logout:', error);
      alert('Произошла ошибка при выходе из системы на сервере. Перенаправление на страницу входа.');
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  if (loading || currentUser === undefined) {
    return (
      <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading profile info...</p>
      </div>
    );
  }

  return (
    <div className="layout-container">
      <header className="header">
        <div className="header-left">
          <Link to={currentUser ? "/home" : "/auth"} className="logo-link">
            <h1 className="logo">Security system control menu</h1>
          </Link>
        </div>
        <div className="header-right">
          {currentUser ? (
            <div className="user-info">
              <Link to="/profile" className="user-name-link">
                Welcome, {currentUser?.name || 'User'}
              </Link>
            </div>
          ) : (
            <Link to="/auth" className="login-link">
              Вход
            </Link>
          )}
        </div>
      </header>

      <div className="main-content-wrapper">
        {currentUser && (
          <aside className="sidebar">
            <nav className="nav-menu">
              <ul>
                <li>
                  <Link to="/home" className="nav-link">
                    <i className="fas fa-home"></i> Main page
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="nav-link">
                    <i className="fas fa-user"></i> Profile
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="sidebar-logout-section">
              <button onClick={handleLogout} className="sidebar-logout-button nav-link">
                <i className="fas fa-sign-out-alt"></i> Logout
              </button>
            </div>
          </aside>
        )}
        <main className={`content-area ${!currentUser ? 'full-width' : ''}`}>
          <Outlet context={{ currentUser, setCurrentUser, fetchCurrentUser }} />
        </main>
      </div>
    </div>
  );
};

export default Layout;