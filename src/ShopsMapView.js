import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import defaultAvatar from './Imatges/default-avatar-profile.jpg';
import defaultRestaurant from './Imatges/default-restaurant.jpg';
import joviatMarkerImage from './Imatges/JoviatJ.png';
import { getRestAlum, getRestaurants, getStudents } from './firestoreApi';

const BARCELONA_CENTER = [41.3874, 2.1686];
const RESTAURANTS_PER_PAGE = 8;

const createJoviatMarkerIcon = (leaflet) => leaflet.icon({
  iconUrl: joviatMarkerImage,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -34],
  className: 'joviat-map-pin',
});

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

const loadMarkerClusterAssets = async () => {
  await loadLeafletAssets();
  if (window.L?.markerClusterGroup) return;

  if (!document.querySelector('link[data-markercluster-base]')) {
    const clusterCss = document.createElement('link');
    clusterCss.rel = 'stylesheet';
    clusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    clusterCss.setAttribute('data-markercluster-base', 'true');
    document.head.appendChild(clusterCss);
  }

  if (!document.querySelector('link[data-markercluster-default]')) {
    const clusterDefaultCss = document.createElement('link');
    clusterDefaultCss.rel = 'stylesheet';
    clusterDefaultCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    clusterDefaultCss.setAttribute('data-markercluster-default', 'true');
    document.head.appendChild(clusterDefaultCss);
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-markercluster]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      if (window.L?.markerClusterGroup) resolve();
      return;
    }

    const clusterScript = document.createElement('script');
    clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    clusterScript.setAttribute('data-markercluster', 'true');
    clusterScript.async = true;
    clusterScript.onload = resolve;
    clusterScript.onerror = reject;
    document.body.appendChild(clusterScript);
  });
};

function ShopsMapView({
  selectedRestaurantId: controlledRestaurantId,
  onSelectRestaurant,
  onOpenStudent,
  onBack,
  onEditRestaurant,
  isAdmin = false,
  reloadToken = 0,
}) {
  const [restaurants, setRestaurants] = useState([]);
  const [students, setStudents] = useState([]);
  const [restAlum, setRestAlum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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
  const setSelectedRestaurantId = useCallback((restaurantId) => {
    if (isControlled) {
      if (onSelectRestaurant) {
        onSelectRestaurant(restaurantId);
      }
      return;
    }
    setInternalSelectedRestaurantId(restaurantId);
  }, [isControlled, onSelectRestaurant]);

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return restaurants;

    return restaurants.filter((restaurant) => restaurant.name.toLowerCase().includes(normalizedSearch));
  }, [restaurants, searchTerm]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRestaurants.length / RESTAURANTS_PER_PAGE)),
    [filteredRestaurants.length]
  );

  useEffect(() => {
    if (currentPage <= totalPages) return;
    setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * RESTAURANTS_PER_PAGE;
    return filteredRestaurants.slice(start, start + RESTAURANTS_PER_PAGE);
  }, [filteredRestaurants, currentPage]);

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
      setCurrentPage(1);
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

  const studentsByRelationRestaurantId = useMemo(() => {
    const relationMap = new Map();
    restAlum.forEach((relation) => {
      const relationRestaurantId = `${relation.restaurantId || ''}`.trim();
      if (!relationRestaurantId) return;
      const student = studentLookup.get(relation.alumniId);
      if (!student) return;

      const current = relationMap.get(relationRestaurantId) || [];
      current.push(student);
      relationMap.set(relationRestaurantId, current);
    });
    return relationMap;
  }, [restAlum, studentLookup]);

  const restaurantStudentsById = useMemo(() => {
    const restaurantStudents = new Map();
    restaurants.forEach((restaurant) => {
      const ids = getRestaurantMatchIds(restaurant);
      const uniqueStudents = new Map();

      ids.forEach((id) => {
        const studentsFromRelation = studentsByRelationRestaurantId.get(id) || [];
        studentsFromRelation.forEach((student) => {
          const studentKey = `${student.id || student.name || id}`;
          if (!uniqueStudents.has(studentKey)) {
            uniqueStudents.set(studentKey, student);
          }
        });
      });

      restaurantStudents.set(restaurant.id, Array.from(uniqueStudents.values()));
    });
    return restaurantStudents;
  }, [restaurants, studentsByRelationRestaurantId]);

  const relatedAlumni = useMemo(() => {
    if (!selectedRestaurantId) return [];
    return restAlum
      .filter((relation) => selectedRestaurantMatchIds.has(relation.restaurantId))
      .map((relation) => ({
        ...relation,
        student: studentLookup.get(relation.alumniId) || null,
      }));
  }, [restAlum, selectedRestaurantId, selectedRestaurantMatchIds, studentLookup]);

  const buildRestaurantPopupContent = useCallback((restaurant) => {
    const studentsForRestaurant = restaurantStudentsById.get(restaurant.id) || [];
    const studentPreview = studentsForRestaurant.slice(0, 3);
    const extraStudents = Math.max(studentsForRestaurant.length - 3, 0);
    const details = restaurant.details || {};
    const address = restaurant.address || details.Address || details.address || 'Direccion no disponible';

    const popupCard = document.createElement('div');
    popupCard.className = 'map-popup-card';

    const image = document.createElement('img');
    image.className = 'map-popup-restaurant-image';
    image.src = restaurant.photoUrl || defaultRestaurant;
    image.alt = restaurant.name || 'Restaurante';
    popupCard.appendChild(image);

    const content = document.createElement('div');
    content.className = 'map-popup-content';

    const title = document.createElement('p');
    title.className = 'map-popup-title';
    title.textContent = restaurant.name || 'Restaurante sin nombre';
    content.appendChild(title);

    const addressLine = document.createElement('p');
    addressLine.className = 'map-popup-address';
    addressLine.textContent = address;
    content.appendChild(addressLine);

    const alumniSummary = document.createElement('p');
    alumniSummary.className = 'map-popup-summary';
    alumniSummary.textContent = `${studentsForRestaurant.length} alumni asociado(s)`;
    content.appendChild(alumniSummary);

    if (studentsForRestaurant.length > 0) {
      const studentsRow = document.createElement('div');
      studentsRow.className = 'map-popup-students-row';

      studentPreview.forEach((student) => {
        const avatar = document.createElement('img');
        avatar.className = 'map-popup-student-avatar';
        avatar.src = student.photoUrl || defaultAvatar;
        avatar.alt = student.name || 'Alumno';
        avatar.title = student.name || 'Alumno';
        studentsRow.appendChild(avatar);
      });

      if (extraStudents > 0) {
        const plusMore = document.createElement('div');
        plusMore.className = 'map-popup-student-more';
        plusMore.textContent = `+${extraStudents}`;
        studentsRow.appendChild(plusMore);
      }

      content.appendChild(studentsRow);
    } else {
      const empty = document.createElement('p');
      empty.className = 'map-popup-empty';
      empty.textContent = 'Sin alumnos asignados';
      content.appendChild(empty);
    }

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'map-popup-action';
    actionButton.textContent = 'Ver informacion';
    actionButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectedRestaurantId(restaurant.id);
    });
    content.appendChild(actionButton);

    popupCard.appendChild(content);
    return popupCard;
  }, [restaurantStudentsById, setSelectedRestaurantId]);

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
          setError(loadError.message || 'Error cargando restaurantes.');
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
        await loadMarkerClusterAssets();
        if (
          cancelled ||
          !window.L ||
          !window.L.markerClusterGroup ||
          !mapContainerRef.current ||
          mapInstanceRef.current
        ) {
          return;
        }

        const map = window.L.map(mapContainerRef.current).setView(BARCELONA_CENTER, 12);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        markersLayerRef.current = window.L.markerClusterGroup({
          maxClusterRadius: 70,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
        });
        map.addLayer(markersLayerRef.current);
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
    const joviatMarkerIcon = createJoviatMarkerIcon(window.L);

    filteredRestaurants
      .filter((restaurant) => typeof restaurant.lat === 'number' && typeof restaurant.lng === 'number')
      .forEach((restaurant) => {
        const marker = window.L.marker([restaurant.lat, restaurant.lng], {
          icon: joviatMarkerIcon,
        }).addTo(markersLayer);
        marker.bindPopup(buildRestaurantPopupContent(restaurant), {
          maxWidth: 310,
          className: 'shop-map-popup-wrapper',
        });
        marker.on('click', () => {
          marker.openPopup();
        });
      });

    if (viewMode === 'map') {
      map.invalidateSize();
    }
  }, [filteredRestaurants, viewMode, mapReady, buildRestaurantPopupContent]);

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
          detailMarkerRef.current = window.L.marker([lat, lng], {
            icon: createJoviatMarkerIcon(window.L),
          }).addTo(map);
        } else {
          detailMarkerRef.current.setLatLng([lat, lng]);
          detailMarkerRef.current.setIcon(createJoviatMarkerIcon(window.L));
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

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (nextPage) => {
    const normalized = Math.min(totalPages, Math.max(1, nextPage));
    setCurrentPage(normalized);
  };

  if (loading) return <p>Cargando restaurantes...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section className="students-view">
      <h1>Restaurantes</h1>
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
            {isAdmin && onEditRestaurant && (
              <button
                type="button"
                className="student-edit-button"
                onClick={() => onEditRestaurant(selectedRestaurant)}
              >
                Editar
              </button>
            )}
          </div>
          <h2>Detalle del restaurante</h2>
          <div className="student-details-header">
            <img
              src={selectedRestaurant.photoUrl || defaultRestaurant}
              alt={selectedRestaurant.name}
              className="student-details-photo"
            />
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
                        <div className="related-card-media">
                          <img
                            src={relation.student?.photoUrl || defaultAvatar}
                            alt={relation.student?.name || 'Alumno'}
                            className="related-avatar"
                          />
                          <div className="related-card-content">
                            <p className="related-title">
                              {relation.student?.name || 'Nombre no disponible'}
                            </p>
                            <p className="related-meta">Rol: {relation.role || '-'}</p>
                            <p className="related-meta">
                              Actual: {formatYesNo(relation.currentJob)}
                            </p>
                          </div>
                        </div>
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
            <label htmlFor="shops-search" className="search-label">Buscar restaurante por nombre</label>
            <div className="search-row">
              <input
                id="shops-search"
                type="text"
                className="search-input"
                placeholder="Ej: Taverna"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
              <button
                type="button"
                className="search-clear"
                onClick={() => handleSearchChange('')}
                aria-label="Limpiar busqueda"
                disabled={!searchTerm}
              >
                x
              </button>
            </div>
          </div>

          <div className="shops-view-toggle" role="tablist" aria-label="Modo de visualizacion de restaurantes">
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

          {filteredRestaurants.length === 0 && <p>No hay restaurantes que coincidan con tu busqueda.</p>}

          <div
            ref={mapContainerRef}
            className={`shops-map ${viewMode !== 'map' || filteredRestaurants.length === 0 ? 'hidden' : ''}`}
          />

          {viewMode === 'list' && (
            <>
              <div className="shops-cards">
                {paginatedRestaurants.map((restaurant) => {
                  const studentsForRestaurant = restaurantStudentsById.get(restaurant.id) || [];
                  const studentPreview = studentsForRestaurant.slice(0, 3);
                  const extraStudents = Math.max(studentsForRestaurant.length - 3, 0);

                  return (
                    <button
                      key={restaurant.id}
                      type="button"
                      className="shop-card shop-card-button"
                      onClick={() => setSelectedRestaurantId(restaurant.id)}
                    >
                      <img
                        src={restaurant.photoUrl || defaultRestaurant}
                        alt={restaurant.name}
                        className="shop-photo"
                      />
                      <h2>{restaurant.name}</h2>
                      <p className="shop-card-meta">
                        Alumnos: {alumniCountByRestaurant.get(restaurant.id) || 0}
                      </p>
                      {studentsForRestaurant.length > 0 ? (
                        <div className="map-popup-students-row">
                          {studentPreview.map((student) => (
                            <img
                              key={`${restaurant.id}-${student.id || student.name}`}
                              src={student.photoUrl || defaultAvatar}
                              alt={student.name || 'Alumno'}
                              title={student.name || 'Alumno'}
                              className="map-popup-student-avatar"
                            />
                          ))}
                          {extraStudents > 0 && (
                            <div className="map-popup-student-more">+{extraStudents}</div>
                          )}
                        </div>
                      ) : (
                        <p className="map-popup-empty">Sin alumnos asignados</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {filteredRestaurants.length > 0 && (
                <div className="pagination-row">
                  <button
                    type="button"
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  <p className="pagination-info">
                    Pagina {currentPage} de {totalPages}
                  </p>
                  <button
                    type="button"
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

export default ShopsMapView;
