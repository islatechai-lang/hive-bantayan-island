'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  useMap, 
  useMapsLibrary 
} from '@vis.gl/react-google-maps';
import { useToast } from '../contexts/ToastContext';
import { Search, Navigation } from 'lucide-react';

// Bantayan Island Bounding Box
const BANTAYAN_BOUNDS = {
  north: 11.32,
  south: 11.07,
  east: 123.88,
  west: 123.65,
};

const BANTAYAN_CENTER = {
  lat: 11.1676,
  lng: 123.7277,
};

function AutocompleteInput({ onPlaceSelect }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);
  const places = useMapsLibrary('places');
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      bounds: BANTAYAN_BOUNDS,
      componentRestrictions: { country: 'ph' },
      fields: ['address_components', 'geometry', 'formatted_address'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        // Check if inside Bantayan bounds
        if (
          lat >= BANTAYAN_BOUNDS.south &&
          lat <= BANTAYAN_BOUNDS.north &&
          lng >= BANTAYAN_BOUNDS.west &&
          lng <= BANTAYAN_BOUNDS.east
        ) {
          onPlaceSelect({
            lat,
            lng,
            address: place.formatted_address || '',
          });
          setInputValue(place.formatted_address || '');
        } else {
          alert('We only deliver to Bantayan Island. Please select a location on the island.');
        }
      }
    });
  }, [places, onPlaceSelect]);

  return (
    <div className="input-group">
      <label className="input-label">Search Delivery Location</label>
      <div className="input-with-icon">
        <span className="input-icon" style={{ display: 'flex', alignItems: 'center' }}>
          <Search size={18} className="text-secondary" />
        </span>
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="Search street, barangay, or landmark..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </div>
    </div>
  );
}

function MapController({ markerPos }) {
  const map = useMap();
  useEffect(() => {
    if (map && markerPos) {
      map.panTo(markerPos);
    }
  }, [map, markerPos]);
  return null;
}

export default function LocationPicker({ value, onChange }) {
  const { showToast } = useToast();
  const [markerPos, setMarkerPos] = useState(value?.location || BANTAYAN_CENTER);
  const [address, setAddress] = useState(value?.address || '');
  const [geocoder, setGeocoder] = useState(null);
  
  // Dynamically load the Google Maps Geocoding Library to prevent "Geocoder is not a constructor" race conditions
  const geocodingLib = useMapsLibrary('geocoding');

  useEffect(() => {
    if (geocodingLib) {
      setGeocoder(new geocodingLib.Geocoder());
    }
  }, [geocodingLib]);

  const reverseGeocode = (lat, lng) => {
    if (!geocoder) return;
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const formattedAddress = results[0].formatted_address;
        setAddress(formattedAddress);
        onChange({
          location: { lat, lng },
          address: formattedAddress,
        });
      }
    });
  };

  const handleMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    // Check bounds
    if (
      lat >= BANTAYAN_BOUNDS.south &&
      lat <= BANTAYAN_BOUNDS.north &&
      lng >= BANTAYAN_BOUNDS.west &&
      lng <= BANTAYAN_BOUNDS.east
    ) {
      const newPos = { lat, lng };
      setMarkerPos(newPos);
      reverseGeocode(lat, lng);
    } else {
      showToast('Delivery pin must be within Bantayan Island bounds!', 'error');
      // Reset map view
      setMarkerPos({ ...markerPos });
    }
  };

  const handlePlaceSelect = ({ lat, lng, address }) => {
    const newPos = { lat, lng };
    setMarkerPos(newPos);
    setAddress(address);
    onChange({
      location: newPos,
      address,
    });
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if (
            lat >= BANTAYAN_BOUNDS.south &&
            lat <= BANTAYAN_BOUNDS.north &&
            lng >= BANTAYAN_BOUNDS.west &&
            lng <= BANTAYAN_BOUNDS.east
          ) {
            const newPos = { lat, lng };
            setMarkerPos(newPos);
            reverseGeocode(lat, lng);
            showToast('Location updated from device GPS!', 'success');
          } else {
            showToast('Your current location is outside Bantayan Island delivery area.', 'warning');
          }
        },
        () => {
          showToast('Failed to access GPS. Please pin location manually.', 'error');
        }
      );
    } else {
      showToast('Geolocation is not supported by your browser.', 'error');
    }
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <div className="flex flex-col gap-sm">
        <AutocompleteInput onPlaceSelect={handlePlaceSelect} />
        
        <div className="map-container">
          <Map
            defaultZoom={12}
            defaultCenter={BANTAYAN_CENTER}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
            mapId="DEMO_MAP_ID"
            restriction={{
              latLngBounds: BANTAYAN_BOUNDS,
              strictBounds: false,
            }}
          >
            <AdvancedMarker
              position={markerPos}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
            />
            <MapController markerPos={markerPos} />
          </Map>

          <button 
            type="button" 
            className="locate-btn" 
            onClick={useCurrentLocation}
            title="Use current GPS location"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Navigation size={20} className="text-accent" />
          </button>
        </div>

        <div className="input-group mt-sm">
          <label className="input-label">Verified Delivery Address</label>
          <textarea
            className="textarea"
            placeholder="Address will be filled when pin is set on map..."
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              onChange({
                location: markerPos,
                address: e.target.value,
              });
            }}
            required
          />
        </div>
      </div>
    </APIProvider>
  );
}
