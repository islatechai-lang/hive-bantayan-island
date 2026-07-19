'use client';

import React, { useEffect, useState, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { MapPin, RefreshCw } from 'lucide-react';

export default function LiveLocationPreview({ location, onRefresh, refreshing }) {
  if (!location) {
    return (
      <div className="live-loc-card live-loc-no-signal">
        <div className="live-loc-no-signal-icon">
          <MapPin size={28} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Location Not Available</div>
          <p className="text-secondary text-sm" style={{ margin: '0.25rem 0 0' }}>
            Please enable GPS in your device settings so our rider can find you.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm btn-pill" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Locating...' : 'Enable GPS'}
        </button>
      </div>
    );
  }

  const pos = { lat: location.lat, lng: location.lng };

  return (
    <div className="live-loc-card">
      <div className="live-loc-header">
        <div className="live-loc-status">
          <span className="live-loc-dot" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live Location Active</span>
        </div>
        <button
          type="button"
          className="live-loc-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh my GPS location"
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      <div className="live-loc-map">
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
          <Map
            defaultZoom={16}
            center={pos}
            gestureHandling="greedy"
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
            mapId="DEMO_MAP_ID"
            clickableIcons={false}
          >
            <AdvancedMarker position={pos} />
          </Map>
        </APIProvider>
      </div>

      <div className="live-loc-footer">
        <MapPin size={14} className="text-accent" />
        <span className="text-secondary text-sm">
          {location.accuracy ? `Accurate to ~${Math.round(location.accuracy)}m` : 'GPS locked'}
          {' · '}Rider will navigate directly to this pin
        </span>
      </div>
    </div>
  );
}
