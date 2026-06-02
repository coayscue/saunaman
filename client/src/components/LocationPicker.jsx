import React, { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function PlacesAutocomplete({ onPlaceSelect }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;
    if (autocompleteRef.current) return;

    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
      componentRestrictions: { country: 'us' },
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        onPlaceSelect({
          name: place.name || place.formatted_address,
          address: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });
  }, [places, onPlaceSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Search location or select on map"
      className="places-autocomplete-input"
    />
  );
}

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    if (zoom) map.setZoom(zoom);
  }, [map, center, zoom]);
  return null;
}

/**
 * LocationPicker component
 *
 * Props:
 *   locations        - array of { id, name, address, lat, lng }
 *   selectedLocation - id of selected preset location (or null)
 *   onSelect(id)     - called when a preset location pin is clicked
 *   customPlace      - { name, address, lat, lng } or null
 *   onCustomPlace(p) - called when user searches or clicks map for a custom location
 */
function LocationPicker({ locations, selectedLocation, onSelect, customPlace, onCustomPlace }) {
  const SF_CENTER = { lat: 37.7849, lng: -122.4694 };
  const selected = locations.find(l => l.id === selectedLocation);
  const panTarget = customPlace?.lat
    ? { center: { lat: customPlace.lat, lng: customPlace.lng }, zoom: 15 }
    : selected
      ? { center: { lat: selected.lat, lng: selected.lng }, zoom: 14 }
      : null;

  const handleMapClick = (event) => {
    const lat = event.detail.latLng.lat();
    const lng = event.detail.latLng.lng();
    onCustomPlace({
      name: `Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
    });
  };

  return (
    <div className="location-picker-with-map">
      {GOOGLE_MAPS_API_KEY ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <PlacesAutocomplete onPlaceSelect={onCustomPlace} />
          </div>
          <div className="location-map-container">
            <Map
              defaultCenter={SF_CENTER}
              defaultZoom={12}
              mapId="DEMO_MAP_ID"
              style={{ height: '300px', width: '100%' }}
              gestureHandling="cooperative"
              disableDefaultUI={false}
              zoomControl={true}
              streetViewControl={false}
              mapTypeControl={false}
              fullscreenControl={false}
              onClick={handleMapClick}
            >
              {panTarget && <MapController center={panTarget.center} zoom={panTarget.zoom} />}
              {locations.map(loc => (
                <AdvancedMarker
                  key={loc.id}
                  position={{ lat: loc.lat, lng: loc.lng }}
                  onClick={() => onSelect(loc.id)}
                >
                  <Pin
                    background={selectedLocation === loc.id ? '#BA160C' : '#4285F4'}
                    borderColor={selectedLocation === loc.id ? '#8B0000' : '#1a73e8'}
                    glyphColor="#fff"
                  />
                </AdvancedMarker>
              ))}
              {customPlace?.lat && (
                <>
                  <AdvancedMarker position={{ lat: customPlace.lat, lng: customPlace.lng }}>
                    <Pin background="#BA160C" borderColor="#8B0000" glyphColor="#fff" />
                  </AdvancedMarker>
                  <InfoWindow
                    position={{ lat: customPlace.lat, lng: customPlace.lng }}
                    options={{ pixelOffset: { x: 0, y: -28 } }}
                  >
                    <div style={{ padding: '4px 0' }}>
                      <strong>{customPlace.name}</strong>
                      <br />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>{customPlace.address}</span>
                    </div>
                  </InfoWindow>
                </>
              )}
              {selected && !customPlace?.lat && (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  options={{ pixelOffset: { x: 0, y: -28 } }}
                >
                  <div style={{ padding: '4px 0' }}>
                    <strong>{selected.name}</strong>
                    <br />
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>{selected.address}</span>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </div>
        </APIProvider>
      ) : (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Type a location address"
            onChange={e => {
              if (e.target.value.trim()) {
                onCustomPlace({ name: e.target.value, address: e.target.value, lat: null, lng: null });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default LocationPicker;
