import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import '../css/Detail.css';

function getCookie(name) {
    const cookieValue = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return cookieValue ? cookieValue.pop() : '';
}

const Detail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [deviceData, setDeviceData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const fetchDeviceData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`https://217.71.129.139:5497/api/items/${id}`, {
                withCredentials: true,
            });
            setDeviceData(response.data);
            setName(response.data.name);
            setLocation(response.data.location);
        } catch (err) {
            console.error("Error fetching device info: ", err);
            let errorMessage = err.response?.data?.message || "Failed to load device data. Please try again later.";
            if (err.response && err.response.status === 404) {
                errorMessage = `Device with ID ${id} not found.`;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchDeviceData();
        } else {
            setError("No device ID provided.");
            setIsLoading(false);
        }
    }, [id]);

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete the device "${deviceData?.name || name}"?`)) {
            try {
                const csrfToken = getCookie('_csrfToken');
                if (!csrfToken) {
                    setError("CSRF token not found. Please refresh the page or try logging in again.");
                    return;
                }

                await axios.delete(`https://217.71.129.139:5497/api/items/${id}`, {
                    withCredentials: true,
                    headers: {
                        'x-csrf-token': csrfToken,
                    },
                });
                navigate("/home", { replace: true });
            } catch (err) {
                console.error("Error deleting this device: ", err);
                let errorMessage = err.response?.data?.message || "Failed to delete device. Please try again.";
                if (err.response && err.response.status === 403) {
                    errorMessage = "CSRF validation failed. Please refresh the page or try logging in again.";
                }
                setError(errorMessage);
            }
        }
    };

    const handleSave = async () => {
        try {
            const csrfToken = getCookie('_csrfToken');
            if (!csrfToken) {
                setError("CSRF token not found. Please refresh the page or try logging in again.");
                return;
            }

            const updatedPayload = { name, location };

            const response = await axios.put(`https://217.71.129.139:5497/api/items/${id}`, updatedPayload, {
                withCredentials: true,
                headers: {
                    'x-csrf-token': csrfToken,
                },
            });

            setDeviceData(prev => ({...prev, name: name, location: location}));
            setName(name);
            setLocation(location);

            setIsEditing(false);
            setError(null);
        } catch (err) {
            console.error("Error updating device info: ", err);
            let errorMessage = err.response?.data?.message || "Failed to save changes. Please try again.";
            if (err.response && err.response.status === 403) {
                errorMessage = "CSRF validation failed. Please refresh the page or try logging in again.";
            }
            setError(errorMessage);
        }
    };

    if (isLoading) {
        return <div className="detail-container"><p>Loading device details...</p></div>;
    }

    if (error) {
        return (
            <div className="detail-container error-message">
                <p>{error}</p>
                <button className="detail-button" onClick={() => {
                    setError(null);
                    if (error.includes("ID provided") || error.includes("not found")) {
                        navigate("/home");
                    } else {
                        fetchDeviceData();
                    }
                }}>
                    {error.includes("ID provided") || error.includes("not found") ? "Back to Home" : "Try Again"}
                </button>
            </div>
        );
    }

    return (
        <div className="detail-container">
            <h1 className="detail-title">Device Detailed Info</h1>
            {!isEditing ? (
                <>
                    <div className="detail-info">
                        <p className="detail-field">
                            <span className="detail-label">ID:</span>
                            <strong>{deviceData?.id}</strong>
                        </p>
                        <p className="detail-field">
                            <span className="detail-label">Device Name:</span>
                            <strong>{deviceData?.name}</strong>
                        </p>
                        <p className="detail-field">
                            <span className="detail-label">Type:</span>
                            <strong>{deviceData?.type}</strong>
                        </p>
                        <p className="detail-field">
                            <span className="detail-label">Location:</span>
                            <strong>{deviceData?.location}</strong>
                        </p>
                        <p className="detail-field">
                            <span className="detail-label">Status:</span>
                            <strong>{deviceData?.status}</strong>
                        </p>
                    </div>

                    <div className="detail-actions">
                        <button className="detail-button" onClick={() => navigate("/home")}>
                            Back to Home
                        </button>
                        <button className="detail-button edit" onClick={() => {
                            setError(null);
                            setName(deviceData?.name || '');
                            setLocation(deviceData?.location || '');
                            setIsEditing(true);
                        }}>
                            Edit
                        </button>
                        <button className="detail-button danger" onClick={handleDelete}>
                            Delete Device
                        </button>
                    </div>
                </>
            ) : (
                <div className="edit-form">
                    <h3 className="edit-title">Edit Device Info</h3>
                    {error && <p className="error-message edit-error">{error}</p>}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                        className="edit-form-container"
                    >
                        <div className="edit-field-group">
                            <label className="edit-label">
                                Device Name:
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="edit-input"
                                />
                            </label>
                            <label className="edit-label">
                                Location:
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    required
                                    className="edit-input"
                                />
                            </label>
                        </div>

                        <div className="edit-field-group read-only">
                            <p className="detail-field">
                                <span className="detail-label">Type:</span>
                                <strong>{deviceData?.type}</strong>
                            </p>
                            <p className="detail-field">
                                <span className="detail-label">Status:</span>
                                <strong>{deviceData?.status}</strong>
                            </p>
                        </div>

                        <div className="edit-actions">
                            <button type="submit" className="edit-button save">
                                Save Changes
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setName(deviceData?.name || '');
                                    setLocation(deviceData?.location || '');
                                    setIsEditing(false);
                                    setError(null);
                                }}
                                className="edit-button cancel"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Detail;