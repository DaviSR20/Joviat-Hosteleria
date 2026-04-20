import { useEffect, useRef, useState } from 'react';
import './App.css';
import logo from './logo_joviat.webp';
import HomeView from './HomeView';
import StudentsView from './StudentsView';
import ShopsMapView from './ShopsMapView';
import { registerWithEmailPassword, signInWithEmailPassword } from './firebaseAuthApi';
import {
  createRestAlum,
  createRestaurant,
  createStudent,
  deleteRestAlum,
  getRestaurants,
  isAdminEmail,
  updateRestAlum,
  updateRestaurant,
  updateStudent,
} from './firestoreApi';

const BARCELONA_CENTER = [41.3874, 2.1686];
const GOOGLE_MAPS_API_KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '').trim();

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

const loadGooglePlacesAssets = async () => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Falta la API key de Google Maps.');
  }

  if (window.google && window.google.maps && window.google.maps.places) return;

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-google-maps]');

    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const googleScript = document.createElement('script');
    googleScript.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    googleScript.setAttribute('data-google-maps', 'true');
    googleScript.async = true;
    googleScript.defer = true;
    googleScript.onload = resolve;
    googleScript.onerror = reject;
    document.body.appendChild(googleScript);
  });
};

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 768);
  const [viewStack, setViewStack] = useState(() => ([
    { section: 'home', selectedStudentId: null, selectedRestaurantId: null },
  ]));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUserEmail, setAuthUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalType, setAdminModalType] = useState('student');
  const [adminMode, setAdminMode] = useState('create');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [adminView, setAdminView] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);

  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPhones, setNewStudentPhones] = useState(['']);
  const [newStudentPhoto, setNewStudentPhoto] = useState('');
  const [newStudentLinkedIn, setNewStudentLinkedIn] = useState('');
  const [newStudentAlumni, setNewStudentAlumni] = useState(true);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [newStudentPasswordConfirm, setNewStudentPasswordConfirm] = useState('');
  const [newStudentRelations, setNewStudentRelations] = useState([
    { restaurantId: '', role: '', currentJob: false, isExisting: false },
  ]);
  const [deletedRelationIds, setDeletedRelationIds] = useState([]);
  const [restaurantsOptions, setRestaurantsOptions] = useState([]);

  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantAddress, setNewRestaurantAddress] = useState('');
  const [newRestaurantEmail, setNewRestaurantEmail] = useState('');
  const [newRestaurantPhone, setNewRestaurantPhone] = useState('');
  const [newRestaurantPhoto, setNewRestaurantPhoto] = useState('');
  const [newRestaurantLat, setNewRestaurantLat] = useState('');
  const [newRestaurantLng, setNewRestaurantLng] = useState('');
  const [restaurantApiQuery, setRestaurantApiQuery] = useState('');
  const [restaurantApiResults, setRestaurantApiResults] = useState([]);
  const [restaurantApiSelectedId, setRestaurantApiSelectedId] = useState('');
  const [restaurantApiError, setRestaurantApiError] = useState('');
  const [restaurantApiLoading, setRestaurantApiLoading] = useState(false);
  const [restaurantApiDetails, setRestaurantApiDetails] = useState(null);
  const [restaurantApiDetailsLoading, setRestaurantApiDetailsLoading] = useState(false);
  const [restaurantSearchTerm, setRestaurantSearchTerm] = useState('');
  const [restaurantSearchError, setRestaurantSearchError] = useState('');
  const [restaurantSearchLoading, setRestaurantSearchLoading] = useState(false);
  const adminMapRef = useRef(null);
  const adminMapInstanceRef = useRef(null);
  const adminMarkerRef = useRef(null);
  const placesServiceRef = useRef(null);
  const currentView = viewStack[viewStack.length - 1];
  const activeSection = currentView.section;
  const selectedStudentId = currentView.selectedStudentId;
  const selectedRestaurantId = currentView.selectedRestaurantId;

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);

      if (!isMobile) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRestaurants = async () => {
      try {
        const restaurantsFromApi = await getRestaurants();
        if (isMounted) {
          const sorted = [...restaurantsFromApi].sort((a, b) => a.name.localeCompare(b.name));
          setRestaurantsOptions(sorted);
        }
      } catch {
        if (isMounted) {
          setRestaurantsOptions([]);
        }
      }
    };

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  const isSidebarVisible = !isMobileView || isMenuOpen;

  const buildView = (current, next) => ({
    section: next.section ?? current.section,
    selectedStudentId:
      next.selectedStudentId === undefined ? current.selectedStudentId : next.selectedStudentId,
    selectedRestaurantId:
      next.selectedRestaurantId === undefined ? current.selectedRestaurantId : next.selectedRestaurantId,
  });

  const isSameView = (a, b) =>
    a.section === b.section &&
    a.selectedStudentId === b.selectedStudentId &&
    a.selectedRestaurantId === b.selectedRestaurantId;

  const pushView = (nextView) => {
    setViewStack((stack) => {
      const current = stack[stack.length - 1];
      const next = buildView(current, nextView);
      if (isSameView(current, next)) return stack;
      return [...stack, next];
    });
  };

  const replaceView = (nextView) => {
    setViewStack((stack) => {
      const current = stack[stack.length - 1];
      const next = buildView(current, nextView);
      if (isSameView(current, next)) return stack;
      const updated = [...stack];
      updated[updated.length - 1] = next;
      return updated;
    });
  };

  const handleSectionChange = (section) => {
    setViewStack((stack) => {
      const current = stack[stack.length - 1];
      const next = buildView(current, { section });
      return [next];
    });
    if (adminView) {
      closeAdminModal();
    }
    if (isMobileView) {
      setIsMenuOpen(false);
    }
  };

  const handleOpenStudentDetail = (studentId) => {
    pushView({
      section: 'students',
      selectedStudentId: studentId,
    });
    if (adminView) {
      closeAdminModal();
    }
    if (isMobileView) {
      setIsMenuOpen(false);
    }
  };

  const handleOpenRestaurantDetail = (restaurantId) => {
    pushView({
      section: 'shops',
      selectedRestaurantId: restaurantId,
    });
    if (adminView) {
      closeAdminModal();
    }
    if (isMobileView) {
      setIsMenuOpen(false);
    }
  };

  const handleSelectStudent = (studentId) => {
    if (!studentId) {
      replaceView({
        section: 'students',
        selectedStudentId: null,
      });
      return;
    }
    handleOpenStudentDetail(studentId);
  };

  const handleSelectRestaurant = (restaurantId) => {
    if (!restaurantId) {
      replaceView({
        section: 'shops',
        selectedRestaurantId: null,
      });
      return;
    }
    handleOpenRestaurantDetail(restaurantId);
  };

  const handleBack = () => {
    setViewStack((stack) => {
      if (stack.length > 1) {
        return stack.slice(0, -1);
      }

      const current = stack[0];
      if (current.section === 'students' && current.selectedStudentId) {
        return [
          {
            ...current,
            selectedStudentId: null,
          },
        ];
      }

      if (current.section === 'shops' && current.selectedRestaurantId) {
        return [
          {
            ...current,
            selectedRestaurantId: null,
          },
        ];
      }

      return stack;
    });
  };

  const handleEditStudent = (student, relations = []) => {
    if (!student) return;
    openAdminModal('student', { mode: 'edit', student, relations });
  };

  const handleEditRestaurant = (restaurant) => {
    if (!restaurant) return;
    openAdminModal('restaurant', { mode: 'edit', restaurant });
  };

  const handleAuthCheck = async () => {
    const normalizedEmail = authEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError('Introduce un correo.');
      return;
    }

    if (!authPassword) {
      setAuthError('Introduce una contrasena.');
      return;
    }

    if (authMode === 'register' && authPassword !== authPasswordConfirm) {
      setAuthError('Las contrasenas no coinciden.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        await registerWithEmailPassword(normalizedEmail, authPassword);
      } else {
        await signInWithEmailPassword(normalizedEmail, authPassword);
      }
      setIsLoggedIn(true);
      setAuthUserEmail(normalizedEmail);
      setIsAuthOpen(false);
      const admin = await isAdminEmail(normalizedEmail);
      setIsAdmin(admin);
    } catch (authErr) {
      setAuthError(authErr.message || 'No se pudo comprobar el correo.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setAuthError('');
    setIsAuthOpen(false);
    setAuthUserEmail('');
    setIsAdmin(false);
  };

  const getDetailValue = (details, keys, fallback = '') => {
    for (const key of keys) {
      if (details && details[key] !== null && details[key] !== undefined && `${details[key]}` !== '') {
        return details[key];
      }
    }
    return fallback;
  };

  const normalizePhoneList = (value) => {
    if (Array.isArray(value)) {
      const cleaned = value.map((phone) => String(phone).trim()).filter(Boolean);
      return cleaned.length ? cleaned : [''];
    }
    if (value !== null && value !== undefined && `${value}`.trim()) {
      return [String(value).trim()];
    }
    return [''];
  };

  const normalizeBoolean = (value, fallback = true) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 'false') return value === 'true';
    return fallback;
  };

  const ensurePlacesService = async () => {
    await loadGooglePlacesAssets();
    if (!placesServiceRef.current) {
      const container = document.createElement('div');
      placesServiceRef.current = new window.google.maps.places.PlacesService(container);
    }
    return placesServiceRef.current;
  };

  const runPlacesTextSearch = async (query) => {
    const service = await ensurePlacesService();
    return new Promise((resolve, reject) => {
      service.textSearch({ query, type: 'restaurant' }, (results, status) => {
        const statusOk = window.google?.maps?.places?.PlacesServiceStatus?.OK;
        const statusZero = window.google?.maps?.places?.PlacesServiceStatus?.ZERO_RESULTS;
        if (status === statusOk) {
          resolve(results || []);
          return;
        }
        if (status === statusZero) {
          resolve([]);
          return;
        }
        reject(new Error('No se pudo buscar en la API.'));
      });
    });
  };

  const runPlaceDetails = async (placeId) => {
    const service = await ensurePlacesService();
    return new Promise((resolve, reject) => {
      service.getDetails(
        {
          placeId,
          fields: [
            'name',
            'formatted_address',
            'formatted_phone_number',
            'international_phone_number',
            'geometry',
            'photos',
          ],
        },
        (place, status) => {
          const statusOk = window.google?.maps?.places?.PlacesServiceStatus?.OK;
          if (status === statusOk) {
            resolve(place);
            return;
          }
          reject(new Error('No se pudo cargar el detalle del restaurante.'));
        }
      );
    });
  };

  const handleRestaurantApiSearch = async () => {
    const query = restaurantApiQuery.trim();
    if (!query) {
      setRestaurantApiError('Introduce un nombre para buscar.');
      return;
    }

    setRestaurantApiError('');
    setRestaurantApiLoading(true);

    try {
      const results = await runPlacesTextSearch(query);
      const mapped = results.map((place) => ({
        id: place.place_id,
        name: place.name || 'Sin nombre',
        address: place.formatted_address || place.vicinity || '',
      }));
      setRestaurantApiResults(mapped);
      setRestaurantApiSelectedId('');
      setRestaurantApiDetails(null);
      if (!mapped.length) {
        setRestaurantApiError('No se encontraron resultados.');
      }
    } catch (apiError) {
      setRestaurantApiError(apiError.message || 'No se pudo buscar en la API.');
    } finally {
      setRestaurantApiLoading(false);
    }
  };

  const handleRestaurantApiSelect = async (placeId) => {
    setRestaurantApiSelectedId(placeId);
    setRestaurantApiDetails(null);
    if (!placeId) return;

    setRestaurantApiDetailsLoading(true);
    setRestaurantApiError('');
    try {
      const details = await runPlaceDetails(placeId);
      setRestaurantApiDetails(details);
    } catch (detailError) {
      setRestaurantApiError(detailError.message || 'No se pudo cargar el detalle.');
    } finally {
      setRestaurantApiDetailsLoading(false);
    }
  };

  const handleRestaurantApiAutofill = async () => {
    if (!restaurantApiSelectedId) {
      setRestaurantApiError('Selecciona un resultado primero.');
      return;
    }

    let details = restaurantApiDetails;
    if (!details) {
      setRestaurantApiDetailsLoading(true);
      setRestaurantApiError('');
      try {
        details = await runPlaceDetails(restaurantApiSelectedId);
        setRestaurantApiDetails(details);
      } catch (detailError) {
        setRestaurantApiError(detailError.message || 'No se pudo cargar el detalle.');
        return;
      } finally {
        setRestaurantApiDetailsLoading(false);
      }
    }

    if (!details) return;

    if (details.name) {
      setNewRestaurantName(details.name);
    }
    if (details.formatted_address) {
      setNewRestaurantAddress(details.formatted_address);
    }
    const phoneValue =
      details.formatted_phone_number || details.international_phone_number || '';
    if (phoneValue) {
      setNewRestaurantPhone(phoneValue);
    }
    if (details.geometry?.location) {
      const lat = details.geometry.location.lat();
      const lng = details.geometry.location.lng();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setNewRestaurantLat(lat.toFixed(6));
        setNewRestaurantLng(lng.toFixed(6));
      }
    }
    if (details.photos && details.photos.length > 0) {
      const photoUrl = details.photos[0].getUrl({ maxWidth: 1200, maxHeight: 800 });
      if (photoUrl) {
        setNewRestaurantPhoto(photoUrl);
      }
    }
  };

  const openAdminModal = (type, { mode = 'create', student, restaurant, relations } = {}) => {
    setAdminModalType(type);
    setAdminError('');
    setAdminModalOpen(true);
    setAdminView(type);
    setAdminMode(mode);
    setEditingStudentId(null);
    setEditingRestaurantId(null);
    setDeletedRelationIds([]);
    if (type === 'student') {
      setNewStudentPassword('');
      setNewStudentPasswordConfirm('');
      if (mode === 'edit' && student) {
        const details = student.details || {};
        setEditingStudentId(student.id || null);
        setNewStudentName(getDetailValue(details, ['Name', 'name'], student.name || ''));
        setNewStudentEmail(getDetailValue(details, ['Email', 'email', 'Mail', 'mail'], ''));
        setNewStudentPhones(normalizePhoneList(details.Phone ?? details.phone));
        setNewStudentPhoto(
          getDetailValue(details, ['PhotoURL', 'PhotoUrl', 'photoUrl'], student.photoUrl || '')
        );
        setNewStudentLinkedIn(getDetailValue(details, ['LinkedIn', 'linkedin'], ''));
        setNewStudentAlumni(normalizeBoolean(details.Alumni ?? details.alumni, true));
        if (Array.isArray(relations) && relations.length) {
          setNewStudentRelations(
            relations.map((relation) => ({
              id: relation.id,
              restaurantId: relation.restaurantId || '',
              role: relation.role || '',
              currentJob: Boolean(relation.currentJob),
              isExisting: true,
            }))
          );
        } else {
          setNewStudentRelations([]);
        }
      } else {
        setNewStudentName('');
        setNewStudentEmail('');
        setNewStudentPhones(['']);
        setNewStudentPhoto('');
        setNewStudentLinkedIn('');
        setNewStudentAlumni(true);
        setNewStudentRelations([{ restaurantId: '', role: '', currentJob: false, isExisting: false }]);
      }
    }
    if (type === 'restaurant') {
      setRestaurantSearchTerm('');
      setRestaurantSearchError('');
      setRestaurantApiQuery('');
      setRestaurantApiResults([]);
      setRestaurantApiSelectedId('');
      setRestaurantApiError('');
      setRestaurantApiLoading(false);
      setRestaurantApiDetails(null);
      setRestaurantApiDetailsLoading(false);
      if (mode === 'edit' && restaurant) {
        const details = restaurant.details || {};
        setEditingRestaurantId(restaurant.id || null);
        setNewRestaurantName(getDetailValue(details, ['Name', 'name'], restaurant.name || ''));
        setNewRestaurantAddress(
          getDetailValue(details, ['Address', 'address'], restaurant.address || '')
        );
        setNewRestaurantEmail(getDetailValue(details, ['Email', 'email'], restaurant.email || ''));
        setNewRestaurantPhone(getDetailValue(details, ['Phone', 'phone'], restaurant.phone || ''));
        setNewRestaurantPhoto(
          getDetailValue(details, ['PhotoURL', 'PhotoUrl', 'photoUrl'], restaurant.photoUrl || '')
        );
        setNewRestaurantLat(
          Number.isFinite(restaurant.lat) ? restaurant.lat.toFixed(6) : ''
        );
        setNewRestaurantLng(
          Number.isFinite(restaurant.lng) ? restaurant.lng.toFixed(6) : ''
        );
      } else {
        setNewRestaurantName('');
        setNewRestaurantAddress('');
        setNewRestaurantEmail('');
        setNewRestaurantPhone('');
        setNewRestaurantPhoto('');
        setNewRestaurantLat('');
        setNewRestaurantLng('');
      }
    }
  };

  const handleAddRelationRow = () => {
    setNewStudentRelations((current) => [
      ...current,
      { restaurantId: '', role: '', currentJob: false, isExisting: false },
    ]);
  };

  const handleAddPhoneRow = () => {
    setNewStudentPhones((current) => [...current, '']);
  };

  const handleRemovePhoneRow = (index) => {
    setNewStudentPhones((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handlePhoneChange = (index, value) => {
    setNewStudentPhones((current) =>
      current.map((phone, rowIndex) => (rowIndex === index ? value : phone))
    );
  };

  const handleRemoveRelationRow = (index) => {
    setNewStudentRelations((current) => {
      const target = current[index];
      if (target?.isExisting && target.id) {
        setDeletedRelationIds((deleted) =>
          deleted.includes(target.id) ? deleted : [...deleted, target.id]
        );
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const updateRelationRow = (index, updates) => {
    setNewStudentRelations((current) =>
      current.map((relation, rowIndex) => (rowIndex === index ? { ...relation, ...updates } : relation))
    );
  };

  const closeAdminModal = () => {
    setAdminModalOpen(false);
    setAdminError('');
    setAdminView(null);
    setAdminMode('create');
    setEditingStudentId(null);
    setEditingRestaurantId(null);
    setDeletedRelationIds([]);
    setRestaurantApiQuery('');
    setRestaurantApiResults([]);
    setRestaurantApiSelectedId('');
    setRestaurantApiError('');
    setRestaurantApiLoading(false);
    setRestaurantApiDetails(null);
    setRestaurantApiDetailsLoading(false);
  };

  const placeAdminMarker = (lat, lng, { flyTo = true } = {}) => {
    if (!adminMapInstanceRef.current || !window.L) return;

    if (!adminMarkerRef.current) {
      adminMarkerRef.current = window.L.marker([lat, lng], { draggable: true });
      adminMarkerRef.current.addTo(adminMapInstanceRef.current);
      adminMarkerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        setNewRestaurantLat(position.lat.toFixed(6));
        setNewRestaurantLng(position.lng.toFixed(6));
      });
    } else {
      adminMarkerRef.current.setLatLng([lat, lng]);
    }

    if (flyTo) {
      adminMapInstanceRef.current.setView([lat, lng], 16);
    }
  };

  const handleRestaurantSearch = async () => {
    const query = restaurantSearchTerm.trim();
    if (!query) {
      setRestaurantSearchError('Introduce una direccion para buscar.');
      return;
    }

    setRestaurantSearchError('');
    setRestaurantSearchLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error('No se pudo buscar la direccion.');
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setRestaurantSearchError('No se encontraron resultados.');
        return;
      }

      const result = results[0];
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setRestaurantSearchError('Resultado sin coordenadas validas.');
        return;
      }

      setNewRestaurantLat(lat.toFixed(6));
      setNewRestaurantLng(lng.toFixed(6));
      if (result.display_name) {
        setNewRestaurantAddress(result.display_name);
      }
      placeAdminMarker(lat, lng, { flyTo: true });
    } catch (searchError) {
      setRestaurantSearchError(searchError.message || 'No se pudo buscar la direccion.');
    } finally {
      setRestaurantSearchLoading(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!newStudentName.trim()) {
      setAdminError('El nombre es obligatorio.');
      return;
    }

    if (!newStudentEmail.trim()) {
      setAdminError('El email es obligatorio.');
      return;
    }

    if (adminMode === 'create') {
      if (!newStudentPassword) {
        setAdminError('La contrasena es obligatoria.');
        return;
      }

      if (newStudentPassword !== newStudentPasswordConfirm) {
        setAdminError('Las contrasenas no coinciden.');
        return;
      }
    }

    const invalidRelation = newStudentRelations.find((relation) => {
      const hasRestaurant = Boolean(relation.restaurantId);
      const hasRole = Boolean(relation.role && relation.role.trim());
      return (hasRestaurant && !hasRole) || (!hasRestaurant && hasRole);
    });
    if (invalidRelation) {
      setAdminError('Completa la tienda y el rol en todas las relaciones.');
      return;
    }

    setAdminError('');
    setAdminLoading(true);

    try {
      let targetStudentId = editingStudentId;
      if (adminMode === 'create') {
        await registerWithEmailPassword(newStudentEmail.trim().toLowerCase(), newStudentPassword);

        const createdStudent = await createStudent({
          name: newStudentName.trim(),
          email: newStudentEmail.trim(),
          phones: newStudentPhones.map((phone) => phone.trim()).filter(Boolean),
          photoUrl: newStudentPhoto.trim(),
          linkedIn: newStudentLinkedIn.trim(),
          alumni: newStudentAlumni,
        });
        targetStudentId = createdStudent.id;
      } else {
        if (!editingStudentId) {
          throw new Error('No se pudo identificar el alumno.');
        }
        await updateStudent({
          id: editingStudentId,
          name: newStudentName.trim(),
          email: newStudentEmail.trim(),
          phones: newStudentPhones.map((phone) => phone.trim()).filter(Boolean),
          photoUrl: newStudentPhoto.trim(),
          linkedIn: newStudentLinkedIn.trim(),
          alumni: newStudentAlumni,
        });
      }

      const validRelations = newStudentRelations.filter(
        (relation) =>
          !relation.isExisting &&
          relation.restaurantId &&
          relation.role.trim()
      );

      const existingRelations = newStudentRelations.filter(
        (relation) =>
          relation.isExisting &&
          relation.id &&
          relation.restaurantId &&
          relation.role.trim()
      );

      const relationTasks = [];

      if (validRelations.length > 0 && targetStudentId) {
        relationTasks.push(
          Promise.all(
            validRelations.map((relation) => createRestAlum({
              alumniId: targetStudentId,
              restaurantId: relation.restaurantId,
              role: relation.role.trim(),
              currentJob: relation.currentJob,
            }))
          )
        );
      }

      if (existingRelations.length > 0) {
        relationTasks.push(
          Promise.all(
            existingRelations.map((relation) =>
              updateRestAlum({
                id: relation.id,
                alumniId: targetStudentId,
                restaurantId: relation.restaurantId,
                role: relation.role.trim(),
                currentJob: relation.currentJob,
              })
            )
          )
        );
      }

      if (deletedRelationIds.length > 0) {
        relationTasks.push(
          Promise.all(deletedRelationIds.map((relationId) => deleteRestAlum(relationId)))
        );
      }

      if (relationTasks.length > 0) {
        await Promise.all(relationTasks);
      }
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPhones(['']);
      setNewStudentPhoto('');
      setNewStudentLinkedIn('');
      setNewStudentAlumni(true);
      setNewStudentPassword('');
      setNewStudentPasswordConfirm('');
      setNewStudentRelations([{ restaurantId: '', role: '', currentJob: false, isExisting: false }]);
      setDeletedRelationIds([]);
      setReloadToken((value) => value + 1);
      closeAdminModal();
    } catch (adminErr) {
      setAdminError(adminErr.message || 'No se pudo guardar el alumno.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSaveRestaurant = async () => {
    if (!newRestaurantName.trim()) {
      setAdminError('El nombre es obligatorio.');
      return;
    }

    const latValue = Number(newRestaurantLat);
    const lngValue = Number(newRestaurantLng);
    const hasLocation = newRestaurantLat.trim() && newRestaurantLng.trim();

    if (hasLocation && (!Number.isFinite(latValue) || !Number.isFinite(lngValue))) {
      setAdminError('Latitud y longitud deben ser numeros validos.');
      return;
    }

    setAdminError('');
    setAdminLoading(true);

    try {
      if (adminMode === 'edit') {
        if (!editingRestaurantId) {
          throw new Error('No se pudo identificar la tienda.');
        }
        await updateRestaurant({
          id: editingRestaurantId,
          name: newRestaurantName.trim(),
          address: newRestaurantAddress.trim(),
          email: newRestaurantEmail.trim(),
          phone: newRestaurantPhone.trim(),
          photoUrl: newRestaurantPhoto.trim(),
          latitude: hasLocation ? latValue : undefined,
          longitude: hasLocation ? lngValue : undefined,
        });
      } else {
        await createRestaurant({
          name: newRestaurantName.trim(),
          address: newRestaurantAddress.trim(),
          email: newRestaurantEmail.trim(),
          phone: newRestaurantPhone.trim(),
          photoUrl: newRestaurantPhoto.trim(),
          latitude: hasLocation ? latValue : undefined,
          longitude: hasLocation ? lngValue : undefined,
        });
      }
      setNewRestaurantName('');
      setNewRestaurantAddress('');
      setNewRestaurantEmail('');
      setNewRestaurantPhone('');
      setNewRestaurantPhoto('');
      setNewRestaurantLat('');
      setNewRestaurantLng('');
      setReloadToken((value) => value + 1);
      closeAdminModal();
    } catch (adminErr) {
      setAdminError(adminErr.message || 'No se pudo guardar la tienda.');
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initAdminMap = async () => {
      if (!adminModalOpen || adminModalType !== 'restaurant') return;
      if (!adminMapRef.current) return;

      try {
        await loadLeafletAssets();
        if (cancelled || !adminMapRef.current || adminMapInstanceRef.current || !window.L) return;

        const map = window.L.map(adminMapRef.current).setView(BARCELONA_CENTER, 13);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        map.on('click', (event) => {
          const { lat, lng } = event.latlng;
          setNewRestaurantLat(lat.toFixed(6));
          setNewRestaurantLng(lng.toFixed(6));
          placeAdminMarker(lat, lng, { flyTo: false });
        });

        adminMapInstanceRef.current = map;

        if (newRestaurantLat && newRestaurantLng) {
          placeAdminMarker(Number(newRestaurantLat), Number(newRestaurantLng), { flyTo: true });
        }

        setTimeout(() => {
          map.invalidateSize();
        }, 0);
      } catch {
        setAdminError('No se pudo cargar el mapa.');
      }
    };

    initAdminMap();

    return () => {
      cancelled = true;
    };
  }, [adminModalOpen, adminModalType]);

  useEffect(() => {
    if (!adminMapInstanceRef.current || !window.L) return;

    const lat = Number(newRestaurantLat);
    const lng = Number(newRestaurantLng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    placeAdminMarker(lat, lng, { flyTo: false });
  }, [newRestaurantLat, newRestaurantLng]);

  useEffect(() => {
    if (adminModalOpen && adminModalType === 'restaurant') return;

    if (adminMapInstanceRef.current) {
      adminMapInstanceRef.current.off();
      adminMapInstanceRef.current.remove();
      adminMapInstanceRef.current = null;
    }
    adminMarkerRef.current = null;
  }, [adminModalOpen, adminModalType]);

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setIsAuthOpen(true);
  };

  return (
    <div className="App">
      <header className="top-bar">
        {isMobileView && (
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setIsMenuOpen((currentState) => !currentState)}
            aria-label="Abrir o cerrar menú lateral"
            aria-expanded={isMenuOpen}
            aria-controls="left-sidebar-menu"
          >
            ☰
          </button>
        )}
        <img src={logo} className="top-bar-logo" alt="Logo Joviat" />
      </header>

      <aside
        id="left-sidebar-menu"
        className={`left-sidebar ${isSidebarVisible ? 'open' : ''}`}
        aria-hidden={!isSidebarVisible}
      >
        <h2 className="sidebar-title">Menú</h2>
        <nav>
          <ul className="sidebar-links">
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'home' ? 'active' : ''}`}
                onClick={() => handleSectionChange('home')}
              >
                Inicio
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'students' ? 'active' : ''}`}
                onClick={() => handleSectionChange('students')}
              >
                Alumnos
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${activeSection === 'shops' ? 'active' : ''}`}
                onClick={() => handleSectionChange('shops')}
              >
                Tiendas
              </button>
            </li>
            {isAdmin && (
              <>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${adminView === 'student' ? 'active' : ''}`}
                    onClick={() => openAdminModal('student')}
                  >
                    Anadir alumno
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${adminView === 'restaurant' ? 'active' : ''}`}
                    onClick={() => openAdminModal('restaurant')}
                  >
                    Anadir tienda
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
        <div className="auth-panel">
          {isLoggedIn ? (
            <button
              type="button"
              className="auth-button"
              onClick={handleLogout}
            >
              Logout {authUserEmail ? `(${authUserEmail})` : ''}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="auth-button"
                onClick={() => openAuthModal('login')}
              >
                Login
              </button>
              <button
                type="button"
                className="auth-button auth-button-secondary"
                onClick={() => openAuthModal('register')}
              >
                Registrarse
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="main-content">
        
        {isAdmin && adminModalOpen && (
          <div className="admin-form-shell">
            <div className="admin-form-header">
              <div className="admin-form-heading">
                <h2>
                  {adminModalType === 'student'
                    ? adminMode === 'edit'
                      ? 'Editar alumno'
                      : 'Crear alumno'
                    : adminMode === 'edit'
                      ? 'Editar tienda'
                      : 'Crear tienda'}
                </h2>
                <p>
                  {adminModalType === 'student'
                    ? adminMode === 'edit'
                      ? 'Actualiza los datos del alumno y revisa su informacion.'
                      : 'Registra un nuevo alumno y verifica su informacion.'
                    : adminMode === 'edit'
                      ? 'Actualiza los datos de la tienda y revisa los detalles.'
                      : 'Registra una nueva tienda y completa los datos clave.'}
                </p>
              </div>
            </div>
            <div className="admin-form-layout">
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h3>{adminModalType === 'student' ? 'Datos personales' : 'Datos de la tienda'}</h3>
                </div>
                {adminModalType === 'student' ? (
                  <>
                    <label className="admin-label" htmlFor="new-student-name">Nombre completo</label>
                    <input
                      id="new-student-name"
                      className="admin-input"
                      type="text"
                      placeholder="Ej: Jordi Hurtado"
                      value={newStudentName}
                      onChange={(event) => setNewStudentName(event.target.value)}
                    />
                    <div className="admin-grid">
                      <div>
                        <label className="admin-label" htmlFor="new-student-linkedin">LinkedIn</label>
                        <input
                          id="new-student-linkedin"
                          className="admin-input"
                          type="text"
                          placeholder="linkedin.com/in/usuario"
                          value={newStudentLinkedIn}
                          onChange={(event) => setNewStudentLinkedIn(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="admin-label" htmlFor="new-student-phone-0">Telefono</label>
                        <div className="admin-phone-list">
                          {newStudentPhones.map((phone, index) => (
                            <div key={`student-phone-${index}`} className="admin-phone-row">
                              <input
                                id={`new-student-phone-${index}`}
                                className="admin-input"
                                type="text"
                                placeholder="678 54 32 56"
                                value={phone}
                                onChange={(event) => handlePhoneChange(index, event.target.value)}
                              />
                              {newStudentPhones.length > 1 && (
                                <button
                                  type="button"
                                  className="admin-remove-row"
                                  onClick={() => handleRemovePhoneRow(index)}
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="admin-add-row"
                            onClick={handleAddPhoneRow}
                          >
                            + Anadir telefono
                          </button>
                        </div>
                      </div>
                    </div>
                    <label className="admin-label" htmlFor="new-student-email">Email</label>
                    <input
                      id="new-student-email"
                      className="admin-input"
                      type="email"
                      placeholder="correo@dominio.com"
                      value={newStudentEmail}
                      onChange={(event) => setNewStudentEmail(event.target.value)}
                    />
                    {adminMode === 'create' && (
                      <div className="admin-grid">
                        <div>
                          <label className="admin-label" htmlFor="new-student-password">Contrasena</label>
                          <input
                            id="new-student-password"
                            className="admin-input"
                            type="password"
                            placeholder="Minimo 6 caracteres"
                            value={newStudentPassword}
                            onChange={(event) => setNewStudentPassword(event.target.value)}
                          />
                        </div>
                        <div>
                          <label className="admin-label" htmlFor="new-student-password-confirm">Confirmar</label>
                          <input
                            id="new-student-password-confirm"
                            className="admin-input"
                            type="password"
                            placeholder="Repite la contrasena"
                            value={newStudentPasswordConfirm}
                            onChange={(event) => setNewStudentPasswordConfirm(event.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <label className="admin-label" htmlFor="new-student-photo">Photo URL</label>
                    <input
                      id="new-student-photo"
                      className="admin-input"
                      type="text"
                      placeholder="https://imagen.com/foto.jpg"
                      value={newStudentPhoto}
                      onChange={(event) => setNewStudentPhoto(event.target.value)}
                    />
                    <div className="admin-toggle">
                      <div>
                        <p className="admin-toggle-title">Estado alumni</p>
                        <p className="admin-toggle-subtitle">Marca si encara es alumne</p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={newStudentAlumni}
                          onChange={(event) => setNewStudentAlumni(event.target.checked)}
                        />
                        <span className="slider" />
                      </label>
                    </div>
                    <div className="admin-form-section">
                      <div className="admin-form-section-header">
                        <h4>Trabajo en</h4>
                        <button
                          type="button"
                          className="admin-add-row"
                          onClick={handleAddRelationRow}
                        >
                          + Anadir restaurante
                        </button>
                      </div>
      {newStudentRelations.map((relation, index) => (
        <div
          key={relation.id ? `relation-${relation.id}` : `${relation.restaurantId}-${index}`}
          className="admin-relation-row"
        >
          <div className="admin-relation-field">
            <label className="admin-label" htmlFor={`relation-restaurant-${index}`}>
              Tienda
            </label>
            <select
              id={`relation-restaurant-${index}`}
              className="admin-input"
              value={relation.restaurantId}
              onChange={(event) => updateRelationRow(index, { restaurantId: event.target.value })}
            >
              <option value="">Selecciona una tienda</option>
              {restaurantsOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                                  {restaurant.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-relation-field">
                            <label className="admin-label" htmlFor={`relation-role-${index}`}>
                              Rol
                            </label>
            <input
              id={`relation-role-${index}`}
              className="admin-input"
              type="text"
              placeholder="Cocinero/a"
              value={relation.role}
              onChange={(event) => updateRelationRow(index, { role: event.target.value })}
            />
          </div>
          <label className="admin-relation-toggle">
            <input
              type="checkbox"
              checked={relation.currentJob}
              onChange={(event) => updateRelationRow(index, { currentJob: event.target.checked })}
            />
            Trabajo actual
          </label>
          {(relation.isExisting || newStudentRelations.length > 1) && (
            <button
              type="button"
              className="admin-remove-row"
              onClick={() => handleRemoveRelationRow(index)}
            >
              {relation.isExisting ? 'Eliminar' : 'Quitar'}
            </button>
          )}
                        </div>
                      ))}
                    </div>
                    {adminError && <p className="auth-error">{adminError}</p>}
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="auth-submit"
                        onClick={handleSaveStudent}
                        disabled={adminLoading}
                      >
                        {adminLoading
                          ? 'Guardando...'
                          : adminMode === 'edit'
                            ? 'Guardar cambios'
                            : 'Guardar alumno'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="admin-label" htmlFor="new-restaurant-name">Nombre</label>
                    <input
                      id="new-restaurant-name"
                      className="admin-input"
                      type="text"
                      placeholder="Nombre del restaurante"
                      value={newRestaurantName}
                      onChange={(event) => setNewRestaurantName(event.target.value)}
                    />
                    <div className="admin-api-section">
                      <label className="admin-label" htmlFor="restaurant-api-search">
                        Buscar en Google
                      </label>
                      <div className="admin-map-search-row">
                        <input
                          id="restaurant-api-search"
                          className="admin-input"
                          type="text"
                          placeholder="Ej: Restaurante italiano en Barcelona"
                          value={restaurantApiQuery}
                          onChange={(event) => setRestaurantApiQuery(event.target.value)}
                        />
                        <button
                          type="button"
                          className="admin-map-search-button"
                          onClick={handleRestaurantApiSearch}
                          disabled={restaurantApiLoading}
                        >
                          {restaurantApiLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                      {restaurantApiError && <p className="auth-error">{restaurantApiError}</p>}
                      {restaurantApiResults.length > 0 && (
                        <div className="admin-api-results">
                          <label className="admin-label" htmlFor="restaurant-api-results">
                            Resultados
                          </label>
                          <div className="admin-api-results-row">
                            <select
                              id="restaurant-api-results"
                              className="admin-input"
                              value={restaurantApiSelectedId}
                              onChange={(event) => handleRestaurantApiSelect(event.target.value)}
                            >
                              <option value="">Selecciona un resultado</option>
                              {restaurantApiResults.map((place) => (
                                <option key={place.id} value={place.id}>
                                  {place.name}
                                  {place.address ? ` - ${place.address}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="admin-map-search-button"
                              onClick={handleRestaurantApiAutofill}
                              disabled={!restaurantApiSelectedId || restaurantApiDetailsLoading}
                            >
                              {restaurantApiDetailsLoading ? 'Cargando...' : 'Autocompletar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <label className="admin-label" htmlFor="new-restaurant-address">Direccion</label>
                    <input
                      id="new-restaurant-address"
                      className="admin-input"
                      type="text"
                      placeholder="Calle Principal, 12"
                      value={newRestaurantAddress}
                      onChange={(event) => setNewRestaurantAddress(event.target.value)}
                    />
                    <div className="admin-grid">
                      <div>
                        <label className="admin-label" htmlFor="new-restaurant-email">Email</label>
                        <input
                          id="new-restaurant-email"
                          className="admin-input"
                          type="email"
                          placeholder="info@restaurante.com"
                          value={newRestaurantEmail}
                          onChange={(event) => setNewRestaurantEmail(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="admin-label" htmlFor="new-restaurant-phone">Telefono</label>
                        <input
                          id="new-restaurant-phone"
                          className="admin-input"
                          type="text"
                          placeholder="612 25 49 25"
                          value={newRestaurantPhone}
                          onChange={(event) => setNewRestaurantPhone(event.target.value)}
                        />
                      </div>
                    </div>
                    <label className="admin-label" htmlFor="new-restaurant-photo">Photo URL</label>
                    <input
                      id="new-restaurant-photo"
                      className="admin-input"
                      type="text"
                      placeholder="https://imagen.com/restaurante.jpg"
                      value={newRestaurantPhoto}
                      onChange={(event) => setNewRestaurantPhoto(event.target.value)}
                    />
                    <div className="admin-map-section">
                      <label className="admin-label" htmlFor="restaurant-search">
                        Buscar direccion
                      </label>
                      <div className="admin-map-search-row">
                        <input
                          id="restaurant-search"
                          className="admin-input"
                          type="text"
                          placeholder="Ej: Plaza de la Independencia, Manresa"
                          value={restaurantSearchTerm}
                          onChange={(event) => setRestaurantSearchTerm(event.target.value)}
                        />
                        <button
                          type="button"
                          className="admin-map-search-button"
                          onClick={handleRestaurantSearch}
                          disabled={restaurantSearchLoading}
                        >
                          {restaurantSearchLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                      {restaurantSearchError && <p className="auth-error">{restaurantSearchError}</p>}
                      <div className="admin-map" ref={adminMapRef} />
                      <p className="admin-map-hint">
                        Haz click en el mapa para marcar la ubicacion. Tambien puedes arrastrar el marcador.
                      </p>
                      {newRestaurantLat && newRestaurantLng && (
                        <p className="admin-map-coords">
                          Lat: {newRestaurantLat} · Lng: {newRestaurantLng}
                        </p>
                      )}
                    </div>
                    {adminError && <p className="auth-error">{adminError}</p>}
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="auth-submit"
                        onClick={handleSaveRestaurant}
                        disabled={adminLoading}
                      >
                        {adminLoading
                          ? 'Guardando...'
                          : adminMode === 'edit'
                            ? 'Guardar cambios'
                            : 'Guardar tienda'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              
            </div>
          </div>
        )}
        {!adminView && activeSection === 'home' && <HomeView />}
        {!adminView && activeSection === 'students' && (
          <StudentsView
            selectedStudentId={selectedStudentId}
            onSelectStudent={handleSelectStudent}
            onOpenRestaurant={handleOpenRestaurantDetail}
            onBack={handleBack}
            onEditStudent={handleEditStudent}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
            reloadToken={reloadToken}
          />
        )}
        {!adminView && activeSection === 'shops' && (
          <ShopsMapView
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={handleSelectRestaurant}
            onOpenStudent={handleOpenStudentDetail}
            onBack={handleBack}
            onEditRestaurant={handleEditRestaurant}
            isAdmin={isAdmin}
            reloadToken={reloadToken}
          />
        )}
      </main>
      {isAuthOpen && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <div className="auth-modal-header">
              <h2>{authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesion'}</h2>
              <button
                type="button"
                className="auth-close"
                onClick={() => setIsAuthOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>
            <div className="auth-modal-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => setAuthMode('register')}
              >
                Registrarse
              </button>
            </div>
            <label htmlFor="auth-email" className="search-label">Correo</label>
            <input
              id="auth-email"
              type="email"
              className="search-input"
              placeholder="correo@dominio.com"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
            <label htmlFor="auth-password" className="search-label">Contrasena</label>
            <input
              id="auth-password"
              type="password"
              className="search-input"
              placeholder="Minimo 6 caracteres"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
            {authMode === 'register' && (
              <>
                <label htmlFor="auth-password-confirm" className="search-label">
                  Confirmar contrasena
                </label>
                <input
                  id="auth-password-confirm"
                  type="password"
                  className="search-input"
                  placeholder="Repite la contrasena"
                  value={authPasswordConfirm}
                  onChange={(event) => setAuthPasswordConfirm(event.target.value)}
                />
              </>
            )}
            {authError && <p className="auth-error">{authError}</p>}
            <button
              type="button"
              className="auth-submit"
              onClick={handleAuthCheck}
              disabled={authLoading}
            >
              {authLoading
                ? 'Comprobando...'
                : authMode === 'register'
                  ? 'Registrarse'
                  : 'Entrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
