'use client';

import React from 'react';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

export default function DeliveryMap({ location, address }) {
  if (!location) return null;

  const lat = parseFloat(location.lat || location._lat);
  const lng = parseFloat(location.lng || location._long);

  const parsedLocation = { lat, lng };

  const handleOpenGoogleMaps = () => {
    // Open external navigation route link
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <div className="flex flex-col gap-sm">
        <div className="map-container map-container-large">
          <Map
            defaultZoom={15}
            defaultCenter={parsedLocation}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
          >
            <Marker position={parsedLocation} />
          </Map>
        </div>
        
        <button
          type="button"
          onClick={handleOpenGoogleMaps}
          className="btn btn-primary btn-block mt-sm"
        >
          🛵 Open Turn-by-Turn GPS Navigation
        </button>
      </div>
    </APIProvider>
  );
}
