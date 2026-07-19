'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Navigation, MapPin, Phone } from 'lucide-react';

// Custom pin element for the buyer
function BuyerPin() {
  return (
    <div style={{
      width: '36px', height: '36px',
      background: 'var(--accent, #EB687E)',
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(235,104,126,0.4)',
      border: '3px solid white',
    }}>
      <MapPin size={16} style={{ transform: 'rotate(45deg)', color: 'white' }} />
    </div>
  );
}

// Custom pin element for the rider (blue dot)
function RiderPin() {
  return (
    <div style={{
      width: '20px', height: '20px',
      background: '#4285F4',
      borderRadius: '50%',
      border: '3px solid white',
      boxShadow: '0 0 0 4px rgba(66,133,244,0.25), 0 2px 6px rgba(0,0,0,0.2)',
    }} />
  );
}

// Auto-fit map bounds to show both pins
function MapBoundsController({ buyerPos, riderPos }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (buyerPos && riderPos) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(buyerPos);
      bounds.extend(riderPos);
      map.fitBounds(bounds, { padding: 60 });
    } else if (buyerPos) {
      map.panTo(buyerPos);
      map.setZoom(15);
    }
  }, [map, buyerPos, riderPos]);

  return null;
}

// Haversine distance formula (km)
function getDistanceKm(pos1, pos2) {
  const R = 6371;
  const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pos1.lat * Math.PI) / 180) *
    Math.cos((pos2.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DeliveryMap({ location, buyerUserId, buyerName, buyerPhone }) {
  const [buyerLivePos, setBuyerLivePos] = useState(null);
  const [riderPos, setRiderPos] = useState(null);
  const watchIdRef = useRef(null);

  // Fallback static location from the order
  const fallbackPos = location
    ? { lat: parseFloat(location.lat || location._lat), lng: parseFloat(location.lng || location._long) }
    : null;

  // Subscribe to buyer's live location in Firestore (real-time)
  useEffect(() => {
    if (!buyerUserId) return;

    const userRef = doc(db, 'users', buyerUserId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.liveLocation && data.liveLocation.lat && data.liveLocation.lng) {
          setBuyerLivePos({
            lat: data.liveLocation.lat,
            lng: data.liveLocation.lng,
            updatedAt: data.liveLocation.updatedAt,
          });
        }
      }
    });

    return () => unsubscribe();
  }, [buyerUserId]);

  // Track rider's own GPS location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setRiderPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error('Rider GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Effective buyer position: prefer live, fallback to order snapshot
  const effectiveBuyerPos = buyerLivePos || fallbackPos;

  // Calculate distance
  const distanceKm = (effectiveBuyerPos && riderPos)
    ? getDistanceKm(effectiveBuyerPos, riderPos)
    : null;

  // Open Google Maps navigation
  const handleNavigate = () => {
    if (!effectiveBuyerPos) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${effectiveBuyerPos.lat},${effectiveBuyerPos.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const handleCallBuyer = () => {
    if (buyerPhone) {
      window.open(`tel:${buyerPhone}`, '_self');
    }
  };

  if (!effectiveBuyerPos) return null;

  const isLive = !!buyerLivePos;

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <div className="flex flex-col gap-sm">
        {/* Status bar */}
        <div className="delivery-status-bar">
          <div className="delivery-status-item">
            <span className={`live-loc-dot ${isLive ? '' : 'offline'}`} />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {isLive ? 'Buyer Live' : 'Last Known Location'}
            </span>
          </div>
          {distanceKm !== null && (
            <div className="delivery-status-item">
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>
                {distanceKm < 1
                  ? `${Math.round(distanceKm * 1000)}m away`
                  : `${distanceKm.toFixed(1)}km away`}
              </span>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="map-container map-container-large">
          <Map
            defaultZoom={14}
            defaultCenter={effectiveBuyerPos}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
            mapId="DEMO_MAP_ID"
          >
            {/* Buyer pin (red) */}
            <AdvancedMarker position={effectiveBuyerPos}>
              <BuyerPin />
            </AdvancedMarker>

            {/* Rider pin (blue dot) */}
            {riderPos && (
              <AdvancedMarker position={riderPos}>
                <RiderPin />
              </AdvancedMarker>
            )}

            <MapBoundsController buyerPos={effectiveBuyerPos} riderPos={riderPos} />
          </Map>
        </div>

        {/* Live update timestamp */}
        {buyerLivePos?.updatedAt && (
          <div className="text-secondary text-sm text-center" style={{ fontSize: '0.75rem' }}>
            Buyer GPS updated: {new Date(buyerLivePos.updatedAt).toLocaleTimeString()}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleNavigate}
            className="btn btn-primary btn-pill"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem' }}
          >
            <Navigation size={18} />
            Navigate to Buyer
          </button>
          {buyerPhone && (
            <button
              type="button"
              onClick={handleCallBuyer}
              className="btn btn-secondary btn-pill"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.9rem 1.2rem' }}
            >
              <Phone size={18} />
            </button>
          )}
        </div>
      </div>
    </APIProvider>
  );
}
