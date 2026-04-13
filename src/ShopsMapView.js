import { useEffect, useMemo, useRef, useState } from 'react';
import { getRestAlum, getRestaurants, getStudents } from './firestoreApi';

const BARCELONA_CENTER = [41.3874, 2.1686];

const loadLeafletAssets = async () => {
  if (window.L) return;

  if (!document.querySelector('link[data-leaflet]')) {
    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    leafletCss.setAttribute('data-leaflet', 'true');
    document.head.appendChild(leafletCss);
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-leaflet]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      if (window.L) resolve();
      return;
    }

    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.setAttribute('data-leaflet', 'true');
    leafletScript.async = true;
    leafletScript.onload = resolve;
    leafletScript.onerror = reject;
    document.body.appendChild(leafletScript);
  });
};

function ShopsMapView({
  selectedRestaurantId: controlledRestaurantId,
  onSelectRestaurant,
  onOpenStudent,
  onBack,
  reloadToken = 0,
}) {
  const [restaurants, setRestaurants] = useState([]);
  const [students, setStudents] = useState([]);
  const [restAlum, setRestAlum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelectedRestaurantId, setInternalSelectedRestaurantId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const detailMapRef = useRef(null);
  const detailMapInstanceRef = useRef(null);
  const detailMarkerRef = useRef(null);

  const isControlled = controlledRestaurantId !== undefined;
  const selectedRestaurantId = isControlled ? controlledRestaurantId : internalSelectedRestaurantId;
  const setSelectedRestaurantId = isControlled ? (onSelectRestaurant || (() => {})) : setInternalSelectedRestaurantId;

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return restaurants;

    return restaurants.filter((restaurant) => restaurant.name.toLowerCase().includes(normalizedSearch));
  }, [restaurants, searchTerm]);

  const selectedRestaurant = useMemo(() => {
    if (!selectedRestaurantId) return null;
    const matchId = `${selectedRestaurantId}`.trim();
    return (
      restaurants.find((restaurant) => {
        const details = restaurant.details || {};
        const candidates = [
          restaurant.id,
          details.id,
          details.Id,
          details.ID,
          details.id_restaurant,
          details.idRestaurant,
          details.restaurantId,
          details.uid,
          details.uid_restaurant,
          details.uidRestaurant,
        ];
        return candidates.some(
          (value) => value !== null && value !== undefined && `${value}`.trim() === matchId
        );
      }) || null
    );
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    if (selectedRestaurantId) {
      setSearchTerm('');
    }
  }, [selectedRestaurantId]);

  const selectedRestaurantMatchIds = useMemo(() => {
    if (!selectedRestaurant) return new Set();
    const details = selectedRestaurant.details || {};
    const candidates = [
      selectedRestaurant.id,
      details.id,
      details.Id,
      details.ID,
      details.id_restaurant,
      details.idRestaurant,
      details.restaurantId,
      details.uid,
      details.uid_restaurant,
      details.uidRestaurant,
    ];
    return new Set(candidates.filter((value) => value !== null && value !== undefined && `${value}`.trim()));
  }, [selectedRestaurant]);

  const studentLookup = useMemo(() => {
    const map = new Map();
    students.forEach((student) => {
      const details = student.details || {};
      const candidates = [
        student.id,
        details.id,
        details.Id,
        details.ID,
        details.id_alumni,
        details.idAlumni,
        details.alumniId,
        details.uid,
        details.uid_alumni,
        details.uidAlumni,
      ];
      candidates
        .filter((value) => value !== null && value !== undefined && `${value}`.trim())
        .forEach((value) => map.set(`${value}`.trim(), student));
    });
    return map;
  }, [students]);

  const restaurantRelationCounts = useMemo(() => {
    const counts = new Map();
    restAlum.forEach((relation) => {
      if (!relation.restaurantId) return;
      const key = `${relation.restaurantId}`.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [restAlum]);

  const getRestaurantMatchIds = (restaurant) => {
    const details = restaurant.details || {};
    const candidates = [
      restaurant.id,
      details.id,
      details.Id,
      details.ID,
      details.id_restaurant,
      details.idRestaurant,
      details.restaurantId,
      details.uid,
      details.uid_restaurant,
      details.uidRestaurant,
    ];
    return candidates
      .filter((value) => value !== null && value !== undefined && `${value}`.trim())
      .map((value) => `${value}`.trim());
  };

  const alumniCountByRestaurant = useMemo(() => {
    const counts = new Map();
    restaurants.forEach((restaurant) => {
      const ids = getRestaurantMatchIds(restaurant);
      const seen = new Set();
      let total = 0;
      ids.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        total += restaurantRelationCounts.get(id) || 0;
      });
      counts.set(restaurant.id, total);
    });
    return counts;
  }, [restaurants, restaurantRelationCounts]);

  const relatedAlumni = useMemo(() => {
    if (!selectedRestaurantId) return [];
    return restAlum
      .filter((relation) => selectedRestaurantMatchIds.has(relation.restaurantId))
      .map((relation) => ({
        ...relation,
        student: studentLookup.get(relation.alumniId) || null,
      }));
  }, [restAlum, selectedRestaurantId, selectedRestaurantMatchIds, studentLookup]);

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      try {
        const [restaurantsFromApi, studentsFromApi, restAlumFromApi] = await Promise.all([
          getRestaurants(),
          getStudents(),
          getRestAlum(),
        ]);
        if (isMounted) {
          setRestaurants(restaurantsFromApi);
          setStudents(studentsFromApi);
          setRestAlum(restAlumFromApi);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || 'Error cargando tiendas.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (selectedRestaurantId) return;
      if (!mapContainerRef.current || loading || error) return;

      try {
        await loadLeafletAssets();
        if (cancelled || !window.L || !mapContainerRef.current || mapInstanceRef.current) return;

        const map = window.L.map(mapContainerRef.current).setView(BARCELONA_CENTER, 12);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        markersLayerRef.current = window.L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        setMapReady(true);
      } catch {
        if (!cancelled) {
          setError('No se pudo cargar el mapa.');
        }
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [loading, error, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      setMapReady(false);
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer || !mapReady) return;

    markersLayer.clearLayers();

    filteredRestaurants
      .filter((restaurant) => typeof restaurant.lat === 'number' && typeof restaurant.lng === 'number')
      .forEach((restaurant) => {
        const marker = window.L.marker([restaurant.lat, restaurant.lng]).addTo(markersLayer);
        marker.bindPopup(`<strong>${restaurant.name}</strong>`);
        marker.on('click', () => setSelectedRestaurantId(restaurant.id));
      });

    if (viewMode === 'map') {
      map.invalidateSize();
    }
  }, [filteredRestaurants, viewMode, mapReady]);

  useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      setMapReady(false);
    }
  }, []);

  const formatDetailValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    if (typeof value === 'object') {
      if (value.latitude !== undefined && value.longitude !== undefined) {
        return `${value.latitude}, ${value.longitude}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatYesNo = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    if (value === 'true' || value === 'false') return value === 'true' ? 'Si' : 'No';
    return String(value);
  };

  const detailEntries = useMemo(() => {
    if (!selectedRestaurant?.details) return [];
    const details = selectedRestaurant.details;
    const usedKeys = new Set();
    const hiddenKeys = new Set([
      'PhotoURL',
      'PhotoUrl',
      'photoUrl',
      'Lat',
      'lat',
      'Latitude',
      'latitude',
      'Latitud',
      'latitud',
      'Lng',
      'lng',
      'Longitude',
      'longitude',
      'Longitud',
      'longitud',
    ]);

    const orderedFields = [
      { label: 'Nombre', keys: ['Name', 'name'] },
      { label: 'Direccion', keys: ['Address', 'address'] },
      { label: 'Email', keys: ['Email', 'email'] },
      { label: 'Telefono', keys: ['Phone', 'phone'] },
    ];

    const orderedEntries = orderedFields
      .map((field) => {
        const matchKey = field.keys.find((key) => Object.prototype.hasOwnProperty.call(details, key));
        if (!matchKey) return null;
        usedKeys.add(matchKey);
        return [field.label, details[matchKey]];
      })
      .filter(Boolean);

    const remainingEntries = Object.entries(details)
      .filter(([key]) => !usedKeys.has(key) && !hiddenKeys.has(key))
      .sort(([a], [b]) => a.localeCompare(b));

    return [...orderedEntries, ...remainingEntries];
  }, [selectedRestaurant]);

  const getRestaurantCoordinates = (restaurant) => {
    if (!restaurant) return null;
    if (Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng)) {
      return { lat: restaurant.lat, lng: restaurant.lng };
    }
    if (Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude)) {
      return { lat: restaurant.latitude, lng: restaurant.longitude };
    }
    const details = restaurant.details || {};
    const latCandidate =
      details.lat ??
      details.Lat ??
      details.latitude ??
      details.Latitude ??
      details.latitud ??
      details.Latitud;
    const lngCandidate =
      details.lng ??
      details.Lng ??
      details.longitude ??
      details.Longitude ??
      details.longitud ??
      details.Longitud;
    const lat = Number(latCandidate);
    const lng = Number(lngCandidate);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return null;
  };

  const selectedRestaurantCoords = useMemo(
    () => getRestaurantCoordinates(selectedRestaurant),
    [selectedRestaurant]
  );

  useEffect(() => {
    let cancelled = false;

    const initDetailMap = async () => {
      if (!selectedRestaurant || !selectedRestaurantCoords) return;
      if (!detailMapRef.current) return;

      try {
        await loadLeafletAssets();
        if (cancelled || !window.L || !detailMapRef.current) return;

        const { lat, lng } = selectedRestaurantCoords;
        let map = detailMapInstanceRef.current;

        if (!map) {
          map = window.L.map(detailMapRef.current).setView([lat, lng], 15);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
          detailMapInstanceRef.current = map;
        } else {
          map.setView([lat, lng], 15);
        }

        if (!detailMarkerRef.current) {
          detailMarkerRef.current = window.L.marker([lat, lng]).addTo(map);
        } else {
          detailMarkerRef.current.setLatLng([lat, lng]);
        }

        setTimeout(() => {
          map.invalidateSize();
        }, 0);
      } catch {
        // Silently fail to avoid blocking the detail view.
      }
    };

    initDetailMap();

    return () => {
      cancelled = true;
    };
  }, [selectedRestaurant, selectedRestaurantCoords]);

  useEffect(() => {
    if (selectedRestaurantId) return;
    if (detailMapInstanceRef.current) {
      detailMapInstanceRef.current.remove();
      detailMapInstanceRef.current = null;
      detailMarkerRef.current = null;
    }
  }, [selectedRestaurantId]);

  useEffect(() => () => {
    if (detailMapInstanceRef.current) {
      detailMapInstanceRef.current.remove();
      detailMapInstanceRef.current = null;
      detailMarkerRef.current = null;
    }
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    setSelectedRestaurantId(null);
  };

  if (loading) return <p>Cargando tiendas...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section className="students-view">
      <h1>Tiendas</h1>
      {selectedRestaurant ? (
        <div className="student-details-page" aria-live="polite">
          <div className="student-details-actions">
            <button
              type="button"
              className="student-back-button"
              onClick={handleBack}
            >
              Volver
            </button>
          </div>
          <h2>Detalle del restaurante</h2>
        <div className="student-details-header">
          {selectedRestaurant.photoUrl ? (
            <img
              src={selectedRestaurant.photoUrl}
              alt={selectedRestaurant.name}
              className="student-details-photo"
            />
          ) : (
            <div className="student-details-photo student-photo-placeholder">
              Sin imagen
            </div>
          )}
          <div>
            <p className="student-details-name">{selectedRestaurant.name}</p>
            <p className="shop-card-meta">Alumnos asociados: {relatedAlumni.length}</p>
          </div>
        </div>
          {detailEntries.length > 0 ? (
            <dl className="student-details-list">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="student-details-row">
                  <dt>{key}</dt>
                  <dd>{formatDetailValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No hay detalles disponibles.</p>
          )}
          <div className="shop-detail-map-section">
            <h3>Ubicacion</h3>
            {selectedRestaurantCoords ? (
              <div className="shop-detail-map" ref={detailMapRef} />
            ) : (
              <p className="shop-detail-map-empty">Ubicacion no disponible.</p>
            )}
          </div>
          <div className="related-section">
            <h3>Alumnos</h3>
            {relatedAlumni.length > 0 ? (
              <ul className="related-list">
                {relatedAlumni.map((relation) => {
                  const targetId = relation.student?.id || relation.alumniId;
                  const canOpen = Boolean(targetId && onOpenStudent);

                  return (
                    <li key={relation.id}>
                      <button
                        type="button"
                        className="related-card related-card-button"
                        onClick={() => {
                          if (canOpen) {
                            onOpenStudent(targetId);
                          }
                        }}
                        disabled={!canOpen}
                      >
                        <p className="related-title">
                          {relation.student?.name || 'Nombre no disponible'}
                        </p>
                        <p className="related-meta">Rol: {relation.role || '-'}</p>
                        <p className="related-meta">
                          Actual: {formatYesNo(relation.currentJob)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No hay alumnos asociados.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="search-box">
            <label htmlFor="shops-search" className="search-label">Buscar tienda por nombre</label>
            <div className="search-row">
              <input
                id="shops-search"
                type="text"
                className="search-input"
                placeholder="Ej: Taverna"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar busqueda"
                disabled={!searchTerm}
              >
                x
              </button>
            </div>
          </div>

          <div className="shops-view-toggle" role="tablist" aria-label="Modo de visualizacion de tiendas">
            <button
              type="button"
              className={`shops-view-button ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              Mapa
            </button>
            <button
              type="button"
              className={`shops-view-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              Listado
            </button>
          </div>

          {filteredRestaurants.length === 0 && <p>No hay tiendas que coincidan con tu busqueda.</p>}

          <div
            ref={mapContainerRef}
            className={`shops-map ${viewMode !== 'map' || filteredRestaurants.length === 0 ? 'hidden' : ''}`}
          />

          {viewMode === 'list' && (
            <div className="shops-cards">
              {filteredRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  className="shop-card shop-card-button"
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                >
                  {restaurant.photoUrl ? (
                    <img
                      src={restaurant.photoUrl}
                      alt={restaurant.name}
                      className="shop-photo"
                    />
                  ) : (
                    <div className="shop-photo shop-photo-placeholder">Sin imagen</div>
                  )}
                  <h2>{restaurant.name}</h2>
                  <p className="shop-card-meta">
                    Alumnos: {alumniCountByRestaurant.get(restaurant.id) || 0}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ShopsMapView;
