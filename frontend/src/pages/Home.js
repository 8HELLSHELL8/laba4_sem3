import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/Home.css";

// Helper function to get a cookie by name
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

const Home = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        // Получаем CSRF-токен из cookies
        const csrfToken = getCookie('_csrfToken');
        if (!csrfToken) {
          setError("CSRF token not found. Please refresh the page or try logging in again.");
          return;
        }

        const response = await axios.get("http://localhost:5000/api/items", {
          withCredentials: true,
          headers: {
            'x-csrf-token': csrfToken, // Добавляем CSRF-токен в заголовки
          },
        });
        setData(response.data);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          setError("Your session may have expired. Please log out and log back in.");
        } else if (err.response && err.response.status === 403) {
          setError("CSRF validation failed. Please refresh the page or try logging in again.");
        } else if (err.response) {
          setError(err.response.data.message || "An error occurred while loading data.");
        } else if (err.request) {
          setError("No response from the server. Please try again later.");
        } else {
          setError("An unexpected error occurred.");
        }
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">Device List</h1>
        <Link to="/add" className="add-device-button">
          Add Device
        </Link>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading devices...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <p>No devices found.</p>
        </div>
      ) : (
        <div className="device-list">
          {data.map((item) => (
            <Link
              to={`/detail/${item.id}`}
              className="device-card"
              key={item.id}
            >
              <div className="device-icon">
                <span className="icon-circle">&#9679;</span>
              </div>
              <div className="device-info">
                <h3>{item.name}</h3>
                <p className="device-type">{item.type || 'Unknown type'}</p>
                <p className="device-status">
                  <span
                    className={`status-indicator ${
                      item.status === 'Active' ? 'active' : 'inactive'
                    }`}
                  >
                    {item.status || 'Inactive'}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;