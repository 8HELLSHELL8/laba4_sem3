import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import '../css/Form.css';

function getCookie(name) {
    const cookieValue = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieValue ? cookieValue.pop() : '';
}

const Form = () => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [error, setError] = useState(null); 
  const navigate = useNavigate();

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleLocationChange = (e) => {
    setLocation(e.target.value);
  };

  const handleTypeChange = (e) => {
    setType(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const csrfToken = getCookie('_csrfToken');
    if (!csrfToken) {
      setError("CSRF token not found. Please refresh the page or try logging in again.");
      return;
    }

    const deviceData = {
      name,
      location,
      type,
      status: 'Inactive',
    };

    try {
      await axios.post('http://217.71.129.139:5733/api/items', deviceData, {
        withCredentials: true, 
        headers: {
          'x-csrf-token': csrfToken, 
        },
      });
      console.log("Device data successfully sent to server");
      navigate('/home');
    } catch (error) {
      console.error("Error sending device data to server: ", error);
      let errorMessage = error.response?.data?.message || "Failed to send device data. Please try again.";
      if (error.response && error.response.status === 403) {
        errorMessage = "CSRF validation failed. Please refresh the page or try logging in again.";
      }
      setError(errorMessage);
    }
  };

  const handleGoHome = () => {
    navigate('/home');
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Add New Device</h2>
      {error && <p className="error-message">{error}</p>}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label className="form-label">
            Device Name:
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">
            Location:
            <select
              value={location}
              onChange={handleLocationChange}
              required
              className="form-input"
            >
              <option value="" disabled>Select a location</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Balcony">Balcony</option>
              <option value="Living Room">Living Room</option>
              <option value="Roof">Roof</option>
              <option value="Server Room A">Server Room A</option>
              <option value="Warehouse B">Warehouse B</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">
            Device Type:
            <select
              value={type}
              onChange={handleTypeChange}
              required
              className="form-input"
            >
              <option value="" disabled>Select a type</option>
              <option value="Camera">Camera</option>
              <option value="Detector">Detector</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="form-button">
            Save Data
          </button>
          <button
            type="button" 
            className="form-button" 
            onClick={handleGoHome} 
          >
            Back to Main
          </button>
        </div>
      </form>
    </div>
  );
};

export default Form;