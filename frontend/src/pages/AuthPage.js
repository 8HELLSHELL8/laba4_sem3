import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; 
import Cookies from 'js-cookie'; 
import '../css/AuthPage.css'; 


const AuthPage = ({ updateAuthState }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const csrfToken = Cookies.get('_csrfToken');
    
    const requestHeaders = {
      'Content-Type': 'application/json', 
    };

    if (csrfToken) {
      requestHeaders['X-CSRF-Token'] = csrfToken;
    }

    try {
      const response = await axios.post(
        'http://localhost:5000/api/login', 
        { name: username, password },
        {
          withCredentials: true, 
          headers: requestHeaders, 
        }
      );

      console.log('Login successful, server response:', response.data);

      if (typeof updateAuthState === 'function') {
        updateAuthState(true, response.data.user); 
      }

      navigate('/home', { replace: true });
    } catch (err) {
      let errorMessage = 'Error while auth';
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Login error:", err.response || err.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Authorize</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Login</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your login"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          

          <button
            type="submit"
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Entering...' : 'Submit'}
          </button>
        </form>

        <div className="auth-footer">
          No account? <a href='/auth'> lol go cry then</a>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;