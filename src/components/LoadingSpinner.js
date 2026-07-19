import React from 'react';

export default function LoadingSpinner({ fullPage = false, text = 'Loading...' }) {
  if (fullPage) {
    return (
      <div className="spinner-overlay">
        <div className="spinner"></div>
        {text && <div className="spinner-text">{text}</div>}
      </div>
    );
  }

  return <div className="spinner spinner-sm"></div>;
}
