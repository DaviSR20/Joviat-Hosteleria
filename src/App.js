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
  getRestaurants,
  isAdminEmail,
} from './firestoreApi';

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
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [adminView, setAdminView] = useState(null);

  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPhones, setNewStudentPhones] = useState(['']);
  const [newStudentPhoto, setNewStudentPhoto] = useState('');
  const [newStudentLinkedIn, setNewStudentLinkedIn] = useState('');
  const [newStudentAlumni, setNewStudentAlumni] = useState(true);
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [newStudentPasswordConfirm, setNewStudentPasswordConfirm] = useState('');
  const [newStudentRelations, setNewStudentRelations] = useState([
    { restaurantId: '', role: '', currentJob: false },
  ]);
  const [restaurantsOptions, setRestaurantsOptions] = useState([]);

  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantAddress, setNewRestaurantAddress] = useState('');
  const [newRestaurantEmail, setNewRestaurantEmail] = useState('');
  const [newRestaurantPhone, setNewRestaurantPhone] = useState('');
  const [newRestaurantPhoto, setNewRestaurantPhoto] = useState('');
  const [newRestaurantLat, setNewRestaurantLat] = useState('');
  const [newRestaurantLng, setNewRestaurantLng] = useState('');
  const [restaurantSearchTerm, setRestaurantSearchTerm] = useState('');
  const [restaurantSearchError, setRestaurantSearchError] = useState('');
  const [restaurantSearchLoading, setRestaurantSearchLoading] = useState(false);
  const adminMapRef = useRef(null);
  const adminMapInstanceRef = useRef(null);
  const adminMarkerRef = useRef(null);
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

  const openAdminModal = (type) => {
    setAdminModalType(type);
    setAdminError('');
    setAdminModalOpen(true);
    setAdminView(type);
    if (type === 'student') {
      setNewStudentRelations([{ restaurantId: '', role: '', currentJob: false }]);
      setNewStudentPassword('');
      setNewStudentPasswordConfirm('');
      setNewStudentPhones(['']);
    }
    if (type === 'restaurant') {
      setRestaurantSearchTerm('');
      setRestaurantSearchError('');
    }
  };

  const handleAddRelationRow = () => {
    setNewStudentRelations((current) => [
      ...current,
      { restaurantId: '', role: '', currentJob: false },
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
    setNewStudentRelations((current) => current.filter((_, rowIndex) => rowIndex !== index));
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

  const handleCreateStudent = async () => {
    if (!newStudentName.trim()) {
      setAdminError('El nombre es obligatorio.');
      return;
    }

    if (!newStudentEmail.trim()) {
      setAdminError('El email es obligatorio.');
      return;
    }

    if (!newStudentPassword) {
      setAdminError('La contrasena es obligatoria.');
      return;
    }

    if (newStudentPassword !== newStudentPasswordConfirm) {
      setAdminError('Las contrasenas no coinciden.');
      return;
    }

    setAdminError('');
    setAdminLoading(true);

    try {
      await registerWithEmailPassword(newStudentEmail.trim().toLowerCase(), newStudentPassword);

      const createdStudent = await createStudent({
        name: newStudentName.trim(),
        email: newStudentEmail.trim(),
        phones: newStudentPhones.map((phone) => phone.trim()).filter(Boolean),
        photoUrl: newStudentPhoto.trim(),
        linkedIn: newStudentLinkedIn.trim(),
        alumni: newStudentAlumni,
      });

      const validRelations = newStudentRelations.filter(
        (relation) => relation.restaurantId && relation.role.trim()
      );

      if (validRelations.length > 0) {
        await Promise.all(
          validRelations.map((relation) => createRestAlum({
            alumniId: createdStudent.id,
            restaurantId: relation.restaurantId,
            role: relation.role.trim(),
            currentJob: relation.currentJob,
          }))
        );
      }
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPhones(['']);
      setNewStudentPhoto('');
      setNewStudentLinkedIn('');
      setNewStudentAlumni(true);
      setNewStudentPassword('');
      setNewStudentPasswordConfirm('');
      setNewStudentRelations([{ restaurantId: '', role: '', currentJob: false }]);
      setReloadToken((value) => value + 1);
      closeAdminModal();
    } catch (adminErr) {
      setAdminError(adminErr.message || 'No se pudo crear el alumno.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleCreateRestaurant = async () => {
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
      await createRestaurant({
        name: newRestaurantName.trim(),
        address: newRestaurantAddress.trim(),
        email: newRestaurantEmail.trim(),
        phone: newRestaurantPhone.trim(),
        photoUrl: newRestaurantPhoto.trim(),
        latitude: hasLocation ? latValue : undefined,
        longitude: hasLocation ? lngValue : undefined,
      });
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
      setAdminError(adminErr.message || 'No se pudo crear la tienda.');
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
                <h2>{adminModalType === 'student' ? 'Crear alumno' : 'Crear tienda'}</h2>
                <p>
                  {adminModalType === 'student'
                    ? 'Registra un nuevo alumno y verifica su informacion.'
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
                        <div key={`${relation.restaurantId}-${index}`} className="admin-relation-row">
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
                          {newStudentRelations.length > 1 && (
                            <button
                              type="button"
                              className="admin-remove-row"
                              onClick={() => handleRemoveRelationRow(index)}
                            >
                              Quitar
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
                        onClick={handleCreateStudent}
                        disabled={adminLoading}
                      >
                        {adminLoading ? 'Guardando...' : 'Guardar alumno'}
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
                        onClick={handleCreateRestaurant}
                        disabled={adminLoading}
                      >
                        {adminLoading ? 'Guardando...' : 'Guardar tienda'}
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
            isAdmin={isAdmin}
            reloadToken={reloadToken}
          />
        )}
        {!adminView && activeSection === 'shops' && (
          <ShopsMapView
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={handleSelectRestaurant}
            onOpenStudent={handleOpenStudentDetail}
            onBack={handleBack}
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
