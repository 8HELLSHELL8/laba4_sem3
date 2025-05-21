import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../css/Profile.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUser } from '@fortawesome/free-solid-svg-icons';

function getCookie(name) {
    const cookieValue = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieValue ? cookieValue.pop() : '';
}

const Profile = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      setError('');

      try {
        const csrfToken = getCookie('_csrfToken');
        if (!csrfToken) {
          setError("CSRF token not found. Please refresh the page or try logging in again.");
          return;
        }

        const response = await axios.get('http://217.71.129.139:5733/api/protected', {
          withCredentials: true,
          headers: {
            'x-csrf-token': csrfToken, 
          },
        });

        if (response.data?.user) {
          if (!response.data.user.id) {
            throw new Error('Invalid user data: missing ID');
          }

          const userData = {
            id: response.data.user.id,
            name: response.data.user.name || 'Unknown',
            role: response.data.user.role || 'user'
          };

          setCurrentUser(userData);
        } else {
          throw new Error('User data not found in response');
        }
      } catch (err) {
        if (err.response?.status === 401) {
          setError("Your session may have expired. Please log in again.");
        } else if (err.response?.status === 403) {
          setError("CSRF validation failed. Please refresh the page or try logging in again.");
        } else if (err.response) {
          setError(err.response.data.message || 'An error occurred while loading profile data.');
        } else if (err.request) {
          setError('Could not connect to the server to load profile.');
        } else {
          setError(err.message || 'An unexpected error occurred while loading profile.');
        }
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleGoBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="profile-container">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container error-state">
        <div className="error-content">
          <FontAwesomeIcon icon={faUser} size="2x" className="error-icon" />
          <p className="error-message">{error}</p>
          <button onClick={handleGoBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft} className="button-icon" /> Back
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser || !currentUser.id) {
    return (
      <div className="profile-container error-state">
        <div className="error-content">
          <FontAwesomeIcon icon={faUser} size="2x" className="error-icon" />
          <p className="error-message">Invalid user data. Please try again.</p>
          <button onClick={handleGoBack} className="back-button">
            <FontAwesomeIcon icon={faArrowLeft} className="button-icon" /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button onClick={handleGoBack} className="back-button">
          <FontAwesomeIcon icon={faArrowLeft} className="button-icon" /> Back
        </button>
        <h2><FontAwesomeIcon icon={faUser} className="profile-icon" /> Your Profile</h2>
      </div>
      <div className="profile-details">
        <p><strong>Name:</strong> {currentUser.name}</p>
        <p><strong>ID:</strong> {currentUser.id}</p>
        {currentUser.role && <p><strong>Role:</strong> {currentUser.role}</p>}
      </div>
    </div>
  );
};

export default Profile;