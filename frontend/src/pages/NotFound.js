import { Link } from "react-router-dom";
import '../css/NotFound.css'

const NotFound = () => {
    return (
        <div className="not-found-container">
            <h1 className="not-found-title">404 - Page Not Found</h1>
            <p className="not-found-message">
                Oops! The page you are looking for does not exist.
            </p>
            <Link to="/" className="not-found-button">
                Back to Main Page
            </Link>
        </div>
    );
}


export default NotFound;