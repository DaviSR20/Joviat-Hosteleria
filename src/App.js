import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import logo from './logo_joviat.webp';
import defaultAvatar from './Imatges/default-avatar-profile.jpg';
import joviatMarkerImage from './Imatges/JoviatJ.png';
import HomeView from './HomeView';
import StudentsView from './StudentsView';
import ShopsMapView from './ShopsMapView';
import { registerWithEmailPassword, signInWithEmailPassword, updatePasswordWithIdToken } from './firebaseAuthApi';
import {
  createAccessRequest,
  createRestaurantRequest,
  createRestAlum,
  createRestaurant,
  createStudentSignup,
  createStudent,
  deleteRestAlum,
  getAccessRequests,
  getRestaurantRequests,
  getRestAlum,
  getRestaurants,
  getStudentSignups,
  getStudents,
  isAdminEmail,
  updateAccessRequestStatus,
  updateRestaurantRequestStatus,
  updateRestAlum,
  updateRestaurant,
  updateStudent,
} from './firestoreApi';

const BARCELONA_CENTER = [41.3874, 2.1686];
const GOOGLE_MAPS_API_KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '').trim();
const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'ES' },
  { value: 'ca', label: 'CA' },
  { value: 'en', label: 'EN' },
];

const UI_TEXT = {
  es: {
    menuTitle: 'Menu',
    home: 'Inicio',
    students: 'Alumnos',
    shops: 'Restaurantes',
    addStudent: 'Anadir alumno',
    addShop: 'Anadir restaurante',
    manageRequests: 'Gestionar altas',
    editProfile: 'Editar perfil',
    login: 'Login',
    requestAccess: 'Solicitar acceso',
    logout: 'Logout',
    language: 'Idioma',
  },
  ca: {
    menuTitle: 'Menu',
    home: 'Inici',
    students: 'Alumnes',
    shops: 'Restaurants',
    addStudent: 'Afegir alumne',
    addShop: 'Afegir restaurant',
    manageRequests: 'Gestionar altes',
    editProfile: 'Editar perfil',
    login: 'Iniciar sessio',
    requestAccess: 'Sol licitar acces',
    logout: 'Sortir',
    language: 'Idioma',
  },
  en: {
    menuTitle: 'Menu',
    home: 'Home',
    students: 'Students',
    shops: 'Restaurants',
    addStudent: 'Add student',
    addShop: 'Add restaurant',
    manageRequests: 'Manage requests',
    editProfile: 'Edit profile',
    login: 'Login',
    requestAccess: 'Request access',
    logout: 'Logout',
    language: 'Language',
  },
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const getLatestApprovedAccessRequestForEmail = (requests, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !Array.isArray(requests)) return null;

  const matches = requests.filter(
    (request) =>
      normalizeEmail(request.email) === normalizedEmail &&
      String(request.status || '').trim().toLowerCase() === 'approved'
  );

  if (matches.length === 0) return null;

  return matches
    .slice()
    .sort((a, b) => {
      const aDate = String(a.reviewedAt || a.createdAt || '');
      const bDate = String(b.reviewedAt || b.createdAt || '');
      return bDate.localeCompare(aDate);
    })[0];
};

const createJoviatMarkerIcon = (leaflet) => leaflet.icon({
  iconUrl: joviatMarkerImage,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -34],
  className: 'joviat-map-pin',
});

const findStudentByEmail = (studentsList, email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  return (
    studentsList.find((student) => {
      const details = student.details || {};
      const candidateEmail = normalizeEmail(
        details.Email || details.email || details.Mail || details.mail
      );
      return candidateEmail === normalized;
    }) || null
  );
};

const getStudentMatchIds = (student) => {
  if (!student) return new Set();
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
  return new Set(
    candidates
      .filter((value) => value !== null && value !== undefined && `${value}`.trim())
      .map((value) => `${value}`.trim())
  );
};

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
  const [authIdToken, setAuthIdToken] = useState('');
  const [authUserPhoto, setAuthUserPhoto] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustChangePasswordOpen, setMustChangePasswordOpen] = useState(false);
  const [mustChangePasswordRequestId, setMustChangePasswordRequestId] = useState('');
  const [mustChangePasswordValue, setMustChangePasswordValue] = useState('');
  const [mustChangePasswordConfirm, setMustChangePasswordConfirm] = useState('');
  const [mustChangePasswordError, setMustChangePasswordError] = useState('');
  const [mustChangePasswordLoading, setMustChangePasswordLoading] = useState(false);
  const [language, setLanguage] = useState('es');
  const [requestAccessEmail, setRequestAccessEmail] = useState('');
  const [requestAccessName, setRequestAccessName] = useState('');
  const [requestAccessLoading, setRequestAccessLoading] = useState(false);
  const [requestAccessMessage, setRequestAccessMessage] = useState('');
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
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState('');
  const [accessRequests, setAccessRequests] = useState([]);
  const [studentSignups, setStudentSignups] = useState([]);
  const [restaurantRequests, setRestaurantRequests] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileStudentId, setProfileStudentId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhones, setProfilePhones] = useState(['']);
  const [profileLinkedIn, setProfileLinkedIn] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [profileAlumni, setProfileAlumni] = useState(true);
  const [profileRelations, setProfileRelations] = useState([]);
  const [profileDeletedRelationIds, setProfileDeletedRelationIds] = useState([]);
  const [profileRestaurantRequests, setProfileRestaurantRequests] = useState([]);
  const [profileRestaurantRequestName, setProfileRestaurantRequestName] = useState('');
  const [profileRestaurantRequestAddress, setProfileRestaurantRequestAddress] = useState('');
  const [profileRestaurantRequestPhone, setProfileRestaurantRequestPhone] = useState('');
  const [profileRestaurantRequestNotes, setProfileRestaurantRequestNotes] = useState('');
  const [profileRestaurantRequestLoading, setProfileRestaurantRequestLoading] = useState(false);
  const [profileRestaurantRequestError, setProfileRestaurantRequestError] = useState('');
  const [profileRestaurantRequestMessage, setProfileRestaurantRequestMessage] = useState('');
  const [profileRestaurantRequestLat, setProfileRestaurantRequestLat] = useState('');
  const [profileRestaurantRequestLng, setProfileRestaurantRequestLng] = useState('');
  const [profileRestaurantMapSearchLoading, setProfileRestaurantMapSearchLoading] = useState(false);
  const [profileRestaurantMapError, setProfileRestaurantMapError] = useState('');
  const adminMapRef = useRef(null);
  const adminMapInstanceRef = useRef(null);
  const adminMarkerRef = useRef(null);
  const profileRequestMapRef = useRef(null);
  const profileRequestMapInstanceRef = useRef(null);
  const profileRequestMarkerRef = useRef(null);
  const placesServiceRef = useRef(null);
  const currentView = viewStack[viewStack.length - 1];
  const activeSection = currentView.section;
  const selectedStudentId = currentView.selectedStudentId;
  const selectedRestaurantId = currentView.selectedRestaurantId;
  const uiText = UI_TEXT[language] || UI_TEXT.es;

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

  useEffect(() => {
    let isMounted = true;

    const loadLoggedProfile = async () => {
      if (!isLoggedIn || !authUserEmail) {
        if (isMounted) {
          setAuthUserPhoto('');
        }
        return;
      }

      try {
        const studentsFromApi = await getStudents();
        if (!isMounted) return;
        const studentMatch = findStudentByEmail(studentsFromApi, authUserEmail);
        setAuthUserPhoto(studentMatch?.photoUrl || '');
      } catch {
        if (isMounted) {
          setAuthUserPhoto('');
        }
      }
    };

    loadLoggedProfile();

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, authUserEmail, reloadToken]);

  const isSidebarVisible = !isMobileView || isMenuOpen;
  const isSidebarButtonActive = (buttonKey) => {
    if (adminView) return adminView === buttonKey;
    return activeSection === buttonKey;
  };

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

  const loadManageData = useCallback(async () => {
    if (!isAdmin) return;
    setManageLoading(true);
    setManageError('');
    try {
      const [requestsFromApi, signupsFromApi, restaurantRequestsFromApi] = await Promise.all([
        getAccessRequests(),
        getStudentSignups(),
        getRestaurantRequests(),
      ]);
      setAccessRequests(requestsFromApi);
      setStudentSignups(signupsFromApi);
      setRestaurantRequests(restaurantRequestsFromApi);
    } catch (manageLoadError) {
      setManageError(manageLoadError.message || 'No se pudo cargar la gestion de altas.');
    } finally {
      setManageLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || adminView !== 'manage' || adminModalOpen) return;
    loadManageData();
  }, [isAdmin, adminView, adminModalOpen, reloadToken, loadManageData]);

  const openManageView = () => {
    closeAdminModal();
    setAdminView('manage');
    loadManageData();
  };

  const handleAccessRequestReview = async (request, status) => {
    if (!request?.id) return;

    try {
      const normalizedStatus = normalizeText(status);
      const requestEmail = normalizeEmail(request.email);

      if (normalizedStatus === 'approved') {
        if (!requestEmail) {
          throw new Error('La solicitud no tiene un correo valido.');
        }

        try {
          // Password provisional: el propio correo. Se forzara cambio en el primer login.
          await registerWithEmailPassword(requestEmail, requestEmail);
        } catch (createUserError) {
          const message = String(createUserError?.message || '');
          if (!message.includes('ya esta registrado')) {
            throw new Error(createUserError.message || 'No se pudo crear el usuario de acceso.');
          }
        }

        await updateAccessRequestStatus({
          id: request.id,
          status: normalizedStatus,
          reviewedBy: authUserEmail,
          mustChangePassword: true,
          authUserCreated: true,
          provisioningError: '',
          updateReviewMetadata: true,
        });
      } else {
        await updateAccessRequestStatus({
          id: request.id,
          status: normalizedStatus,
          reviewedBy: authUserEmail,
          mustChangePassword: false,
          authUserCreated: false,
          updateReviewMetadata: true,
        });
      }

      await loadManageData();
    } catch (reviewError) {
      setManageError(reviewError.message || 'No se pudo actualizar la solicitud.');
    }
  };

  const handleRestaurantRequestReview = async (request, status) => {
    if (!request?.id) return;

    try {
      const normalizedStatus = normalizeText(status);
      if (normalizedStatus === 'approved') {
        const restaurantName = String(request.restaurantName || '').trim();
        if (!restaurantName) {
          throw new Error('La solicitud no tiene nombre de restaurante.');
        }

        const existingRestaurants = await getRestaurants();
        const targetAddress = normalizeText(request.restaurantAddress);
        const duplicateRestaurant = existingRestaurants.some((restaurant) => {
          const sameName = normalizeText(restaurant.name) === normalizeText(restaurantName);
          if (!sameName) return false;
          if (!targetAddress) return true;
          return normalizeText(restaurant.address) === targetAddress;
        });

        if (!duplicateRestaurant) {
          const requestLat = Number(request.lat);
          const requestLng = Number(request.lng);
          await createRestaurant({
            name: restaurantName,
            address: String(request.restaurantAddress || '').trim(),
            phone: String(request.restaurantPhone || '').trim(),
            latitude: Number.isFinite(requestLat) ? requestLat : undefined,
            longitude: Number.isFinite(requestLng) ? requestLng : undefined,
          });
        }
      }

      await updateRestaurantRequestStatus({
        id: request.id,
        status: normalizedStatus,
        reviewedBy: authUserEmail,
      });

      setReloadToken((value) => value + 1);
      await loadManageData();
    } catch (reviewError) {
      setManageError(reviewError.message || 'No se pudo actualizar la solicitud de restaurante.');
    }
  };

  const loadProfileData = async () => {
    if (!isLoggedIn || !authUserEmail) return;

    setProfileLoading(true);
    setProfileError('');
    setProfileMessage('');
    setProfileRestaurantRequestError('');
    setProfileRestaurantRequestMessage('');
    setProfileRestaurantMapError('');
    setProfileRestaurantRequestLat('');
    setProfileRestaurantRequestLng('');

    try {
      const [studentsFromApi, relationsFromApi, restaurantRequestsFromApi] = await Promise.all([
        getStudents(),
        getRestAlum(),
        getRestaurantRequests(),
      ]);
      const studentMatch = findStudentByEmail(studentsFromApi, authUserEmail);
      fillProfileFromStudent(studentMatch, authUserEmail);

      if (studentMatch) {
        const studentIds = getStudentMatchIds(studentMatch);
        const mappedRelations = relationsFromApi
          .filter((relation) => studentIds.has(relation.alumniId))
          .map((relation) => ({
            id: relation.id,
            restaurantId: relation.restaurantId || '',
            role: relation.role || '',
            currentJob: Boolean(relation.currentJob),
            isExisting: true,
          }));
        setProfileRelations(mappedRelations);
      } else {
        setProfileRelations([]);
      }

      const ownRestaurantRequests = restaurantRequestsFromApi
        .filter((request) => normalizeEmail(request.requesterEmail) === normalizeEmail(authUserEmail))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setProfileRestaurantRequests(ownRestaurantRequests);
    } catch (profileLoadError) {
      setProfileError(profileLoadError.message || 'No se pudo cargar tu perfil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const openProfileView = () => {
    closeAdminModal();
    setAdminView('profile');
    loadProfileData();
  };

  const handleProfilePhoneChange = (index, value) => {
    setProfilePhones((current) =>
      current.map((phone, rowIndex) => (rowIndex === index ? value : phone))
    );
  };

  const handleAddProfilePhone = () => {
    setProfilePhones((current) => [...current, '']);
  };

  const handleRemoveProfilePhone = (index) => {
    setProfilePhones((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleAddProfileRelationRow = () => {
    setProfileRelations((current) => [
      ...current,
      { restaurantId: '', role: '', currentJob: false, isExisting: false },
    ]);
  };

  const updateProfileRelationRow = (index, updates) => {
    setProfileRelations((current) =>
      current.map((relation, rowIndex) => (rowIndex === index ? { ...relation, ...updates } : relation))
    );
  };

  const handleRemoveProfileRelationRow = (index) => {
    setProfileRelations((current) => {
      const target = current[index];
      if (target?.isExisting && target.id) {
        setProfileDeletedRelationIds((deleted) =>
          deleted.includes(target.id) ? deleted : [...deleted, target.id]
        );
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleProfileRestaurantRequestSubmit = async () => {
    const restaurantName = profileRestaurantRequestName.trim();
    if (!restaurantName) {
      setProfileRestaurantRequestError('Indica el nombre del restaurante.');
      return;
    }

    const duplicatePending = profileRestaurantRequests.some(
      (request) =>
        String(request.restaurantName || '').trim().toLowerCase() === restaurantName.toLowerCase() &&
        request.status === 'pending'
    );
    if (duplicatePending) {
      setProfileRestaurantRequestError('Ya tienes una solicitud pendiente para este restaurante.');
      return;
    }

    setProfileRestaurantRequestLoading(true);
    setProfileRestaurantRequestError('');
    setProfileRestaurantRequestMessage('');
    setProfileRestaurantMapError('');

    try {
      const latValue = Number(profileRestaurantRequestLat);
      const lngValue = Number(profileRestaurantRequestLng);
      const hasLocation = profileRestaurantRequestLat.trim() && profileRestaurantRequestLng.trim();

      const createdRequest = await createRestaurantRequest({
        requesterEmail: authUserEmail,
        requesterName: profileName.trim() || authUserEmail,
        restaurantName,
        restaurantAddress: profileRestaurantRequestAddress.trim(),
        restaurantPhone: profileRestaurantRequestPhone.trim(),
        notes: profileRestaurantRequestNotes.trim(),
        latitude: hasLocation && Number.isFinite(latValue) ? latValue : undefined,
        longitude: hasLocation && Number.isFinite(lngValue) ? lngValue : undefined,
      });

      setProfileRestaurantRequests((current) => [
        {
          id: createdRequest.id,
          requesterEmail: normalizeEmail(authUserEmail),
          requesterName: profileName.trim() || authUserEmail,
          restaurantName,
          restaurantAddress: profileRestaurantRequestAddress.trim(),
          restaurantPhone: profileRestaurantRequestPhone.trim(),
          notes: profileRestaurantRequestNotes.trim(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          lat: hasLocation && Number.isFinite(latValue) ? latValue : undefined,
          lng: hasLocation && Number.isFinite(lngValue) ? lngValue : undefined,
        },
        ...current,
      ]);

      setProfileRestaurantRequestName('');
      setProfileRestaurantRequestAddress('');
      setProfileRestaurantRequestPhone('');
      setProfileRestaurantRequestNotes('');
      setProfileRestaurantRequestLat('');
      setProfileRestaurantRequestLng('');
      setProfileRestaurantRequestMessage('Solicitud enviada correctamente.');
    } catch (requestError) {
      setProfileRestaurantRequestError(requestError.message || 'No se pudo enviar la solicitud.');
    } finally {
      setProfileRestaurantRequestLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isLoggedIn || !authUserEmail) return;
    if (!profileName.trim()) {
      setProfileError('El nombre es obligatorio.');
      return;
    }

    const invalidRelation = profileRelations.find((relation) => {
      const hasRestaurant = Boolean(relation.restaurantId);
      const hasRole = Boolean(relation.role && relation.role.trim());
      return (hasRestaurant && !hasRole) || (!hasRestaurant && hasRole);
    });
    if (invalidRelation) {
      setProfileError('Completa restaurante y rol en todas las relaciones.');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const phones = profilePhones.map((phone) => phone.trim()).filter(Boolean);
      let targetStudentId = profileStudentId;

      if (profileStudentId) {
        await updateStudent({
          id: profileStudentId,
          name: profileName.trim(),
          email: authUserEmail,
          phones,
          photoUrl: profilePhoto.trim(),
          linkedIn: profileLinkedIn.trim(),
          alumni: profileAlumni,
        });
      } else {
        const createdStudent = await createStudent({
          name: profileName.trim(),
          email: authUserEmail,
          phones,
          photoUrl: profilePhoto.trim(),
          linkedIn: profileLinkedIn.trim(),
          alumni: profileAlumni,
        });
        targetStudentId = createdStudent.id || '';
        setProfileStudentId(targetStudentId);
        await createStudentSignup({
          studentId: targetStudentId,
          name: profileName.trim(),
          email: authUserEmail,
          source: 'profile',
          requestedBy: authUserEmail,
          status: 'approved',
        });
      }

      const newRelations = profileRelations.filter(
        (relation) =>
          !relation.isExisting &&
          relation.restaurantId &&
          relation.role.trim()
      );
      const existingRelations = profileRelations.filter(
        (relation) =>
          relation.isExisting &&
          relation.id &&
          relation.restaurantId &&
          relation.role.trim()
      );

      const relationTasks = [];

      if (newRelations.length > 0 && targetStudentId) {
        relationTasks.push(
          Promise.all(
            newRelations.map((relation) => createRestAlum({
              alumniId: targetStudentId,
              restaurantId: relation.restaurantId,
              role: relation.role.trim(),
              currentJob: relation.currentJob,
            }))
          )
        );
      }

      if (existingRelations.length > 0 && targetStudentId) {
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

      if (profileDeletedRelationIds.length > 0) {
        relationTasks.push(
          Promise.all(profileDeletedRelationIds.map((relationId) => deleteRestAlum(relationId)))
        );
      }

      if (relationTasks.length > 0) {
        await Promise.all(relationTasks);
      }

      setProfileDeletedRelationIds([]);
      setReloadToken((value) => value + 1);
      setAuthUserPhoto(profilePhoto.trim());
      await loadProfileData();
      setProfileMessage('Perfil actualizado correctamente.');
    } catch (profileSaveError) {
      setProfileError(profileSaveError.message || 'No se pudo guardar tu perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestAccess = async () => {
    const normalizedEmail = normalizeEmail(requestAccessEmail);
    const normalizedName = String(requestAccessName || '').trim();

    if (!normalizedEmail) {
      setAuthError('Introduce un correo.');
      return;
    }

    if (!normalizedName) {
      setAuthError('Introduce nombre y apellidos.');
      return;
    }

    setRequestAccessLoading(true);
    setAuthError('');
    setRequestAccessMessage('');

    try {
      const [studentsFromApi, requestsFromApi, emailIsAdmin] = await Promise.all([
        getStudents(),
        getAccessRequests(),
        isAdminEmail(normalizedEmail),
      ]);

      const existingStudent = findStudentByEmail(studentsFromApi, normalizedEmail);
      if (existingStudent || emailIsAdmin) {
        throw new Error('Ese correo ya tiene acceso en la web.');
      }

      const existingRequest = requestsFromApi.find(
        (request) =>
          normalizeEmail(request.email) === normalizedEmail &&
          request.status !== 'rejected'
      );
      if (existingRequest) {
        throw new Error('Ya existe una solicitud de acceso con este correo.');
      }

      await createAccessRequest({
        email: normalizedEmail,
        fullName: normalizedName,
      });

      setRequestAccessEmail('');
      setRequestAccessName('');
      setRequestAccessMessage('Solicitud enviada. Un administrador revisara tu acceso.');
    } catch (requestError) {
      setAuthError(requestError.message || 'No se pudo enviar la solicitud.');
    } finally {
      setRequestAccessLoading(false);
    }
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
    setRequestAccessMessage('');
    setAuthLoading(true);

    try {
      let authResponse = null;
      if (authMode === 'register') {
        authResponse = await registerWithEmailPassword(normalizedEmail, authPassword);
      } else {
        authResponse = await signInWithEmailPassword(normalizedEmail, authPassword);
      }
      setIsLoggedIn(true);
      setAuthUserEmail(normalizedEmail);
      setAuthIdToken(authResponse?.idToken || '');
      setIsAuthOpen(false);
      const admin = await isAdminEmail(normalizedEmail);
      setIsAdmin(admin);

      if (authMode === 'login' && !admin) {
        const accessRequests = await getAccessRequests();
        const approvedRequest = getLatestApprovedAccessRequestForEmail(accessRequests, normalizedEmail);
        const requiresPasswordChange = Boolean(approvedRequest?.mustChangePassword);

        if (approvedRequest?.id && requiresPasswordChange) {
          setMustChangePasswordRequestId(approvedRequest.id);
          setMustChangePasswordValue('');
          setMustChangePasswordConfirm('');
          setMustChangePasswordError('');
          setMustChangePasswordOpen(true);
        } else {
          setMustChangePasswordOpen(false);
          setMustChangePasswordRequestId('');
        }
      } else {
        setMustChangePasswordOpen(false);
        setMustChangePasswordRequestId('');
      }
    } catch (authErr) {
      setAuthError(authErr.message || 'No se pudo comprobar el correo.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequiredPasswordChange = async () => {
    const nextPassword = mustChangePasswordValue.trim();
    if (!nextPassword) {
      setMustChangePasswordError('Introduce una nueva contrasena.');
      return;
    }

    if (nextPassword.length < 6) {
      setMustChangePasswordError('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    if (nextPassword !== mustChangePasswordConfirm.trim()) {
      setMustChangePasswordError('Las contrasenas no coinciden.');
      return;
    }

    if (!authIdToken) {
      setMustChangePasswordError('Tu sesion no es valida. Cierra sesion e inicia de nuevo.');
      return;
    }

    setMustChangePasswordLoading(true);
    setMustChangePasswordError('');

    try {
      const updateResponse = await updatePasswordWithIdToken(authIdToken, nextPassword);
      setAuthIdToken(updateResponse?.idToken || authIdToken);

      if (mustChangePasswordRequestId) {
        await updateAccessRequestStatus({
          id: mustChangePasswordRequestId,
          status: 'approved',
          mustChangePassword: false,
          updateReviewMetadata: false,
        });
      }

      setMustChangePasswordOpen(false);
      setMustChangePasswordRequestId('');
      setMustChangePasswordValue('');
      setMustChangePasswordConfirm('');
    } catch (changeError) {
      setMustChangePasswordError(changeError.message || 'No se pudo cambiar la contrasena.');
    } finally {
      setMustChangePasswordLoading(false);
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('Quieres cerrar sesion?');
    if (!confirmed) return;

    setIsLoggedIn(false);
    setAuthEmail('');
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setAuthError('');
    setIsAuthOpen(false);
    setAuthUserEmail('');
    setAuthIdToken('');
    setAuthUserPhoto('');
    setIsAdmin(false);
    setAdminView(null);
    setMustChangePasswordOpen(false);
    setMustChangePasswordRequestId('');
    setMustChangePasswordValue('');
    setMustChangePasswordConfirm('');
    setMustChangePasswordError('');
    setMustChangePasswordLoading(false);
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

  const fillProfileFromStudent = (student, fallbackEmail = '') => {
    if (!student) {
      setProfileStudentId('');
      setProfileName('');
      setProfilePhones(['']);
      setProfileLinkedIn('');
      setProfilePhoto('');
      setProfileAlumni(true);
      setProfileRelations([]);
      setProfileDeletedRelationIds([]);
      return;
    }

    const details = student.details || {};
    setProfileStudentId(student.id || '');
    setProfileName(getDetailValue(details, ['Name', 'name'], student.name || ''));
    setProfilePhones(normalizePhoneList(details.Phone ?? details.phone));
    setProfileLinkedIn(getDetailValue(details, ['LinkedIn', 'linkedin'], ''));
    setProfilePhoto(
      getDetailValue(details, ['PhotoURL', 'PhotoUrl', 'photoUrl'], student.photoUrl || '')
    );
    setProfileAlumni(normalizeBoolean(details.Alumni ?? details.alumni, true));
    setProfileDeletedRelationIds([]);
    if (!authEmail && fallbackEmail) {
      setAuthEmail(fallbackEmail);
    }
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
    setProfileError('');
    setProfileMessage('');
    setProfileRestaurantRequestError('');
    setProfileRestaurantRequestMessage('');
    setProfileRestaurantMapError('');
  };

  const placeAdminMarker = (lat, lng, { flyTo = true } = {}) => {
    if (!adminMapInstanceRef.current || !window.L) return;
    const joviatMarkerIcon = createJoviatMarkerIcon(window.L);

    if (!adminMarkerRef.current) {
      adminMarkerRef.current = window.L.marker([lat, lng], {
        draggable: true,
        icon: joviatMarkerIcon,
      });
      adminMarkerRef.current.addTo(adminMapInstanceRef.current);
      adminMarkerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        setNewRestaurantLat(position.lat.toFixed(6));
        setNewRestaurantLng(position.lng.toFixed(6));
      });
    } else {
      adminMarkerRef.current.setLatLng([lat, lng]);
      adminMarkerRef.current.setIcon(joviatMarkerIcon);
    }

    if (flyTo) {
      adminMapInstanceRef.current.setView([lat, lng], 16);
    }
  };

  const reverseGeocodeProfileRestaurantRequest = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      if (!response.ok) return;
      const result = await response.json();
      if (result?.display_name) {
        setProfileRestaurantRequestAddress(result.display_name);
      }
    } catch {
      // Ignore reverse geocode errors to avoid blocking the user flow.
    }
  }, []);

  const placeProfileRequestMarker = useCallback((lat, lng, { flyTo = true } = {}) => {
    if (!profileRequestMapInstanceRef.current || !window.L) return;
    const joviatMarkerIcon = createJoviatMarkerIcon(window.L);

    if (!profileRequestMarkerRef.current) {
      profileRequestMarkerRef.current = window.L.marker([lat, lng], {
        draggable: true,
        icon: joviatMarkerIcon,
      });
      profileRequestMarkerRef.current.addTo(profileRequestMapInstanceRef.current);
      profileRequestMarkerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        const nextLat = position.lat.toFixed(6);
        const nextLng = position.lng.toFixed(6);
        setProfileRestaurantRequestLat(nextLat);
        setProfileRestaurantRequestLng(nextLng);
        reverseGeocodeProfileRestaurantRequest(nextLat, nextLng);
      });
    } else {
      profileRequestMarkerRef.current.setLatLng([lat, lng]);
      profileRequestMarkerRef.current.setIcon(joviatMarkerIcon);
    }

    if (flyTo) {
      profileRequestMapInstanceRef.current.setView([lat, lng], 16);
    }
  }, [reverseGeocodeProfileRestaurantRequest]);

  const handleProfileRestaurantMapSearch = async () => {
    const query = profileRestaurantRequestAddress.trim();
    if (!query) {
      setProfileRestaurantMapError('Introduce una direccion para buscar en el mapa.');
      return;
    }

    setProfileRestaurantMapSearchLoading(true);
    setProfileRestaurantMapError('');

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error('No se pudo buscar la direccion en el mapa.');
      }

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('No se encontraron resultados para esta direccion.');
      }

      const result = results[0];
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('El resultado no tiene coordenadas validas.');
      }

      setProfileRestaurantRequestLat(lat.toFixed(6));
      setProfileRestaurantRequestLng(lng.toFixed(6));
      if (result.display_name) {
        setProfileRestaurantRequestAddress(result.display_name);
      }
      placeProfileRequestMarker(lat, lng, { flyTo: true });
    } catch (searchError) {
      setProfileRestaurantMapError(searchError.message || 'No se pudo buscar la direccion en el mapa.');
    } finally {
      setProfileRestaurantMapSearchLoading(false);
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
      setAdminError('Completa el restaurante y el rol en todas las relaciones.');
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
        await createStudentSignup({
          studentId: createdStudent.id,
          name: newStudentName.trim(),
          email: newStudentEmail.trim(),
          source: 'admin',
          requestedBy: authUserEmail,
          status: 'approved',
        });
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
          throw new Error('No se pudo identificar el restaurante.');
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
      setAdminError(adminErr.message || 'No se pudo guardar el restaurante.');
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
  }, [adminModalOpen, adminModalType, newRestaurantLat, newRestaurantLng]);

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

  useEffect(() => {
    let cancelled = false;

    const shouldShowProfileMap = isLoggedIn && adminView === 'profile' && !adminModalOpen;
    if (!shouldShowProfileMap) return undefined;
    if (!profileRequestMapRef.current) return undefined;

    const initProfileRequestMap = async () => {
      try {
        await loadLeafletAssets();
        if (cancelled || !profileRequestMapRef.current || profileRequestMapInstanceRef.current || !window.L) return;

        const map = window.L.map(profileRequestMapRef.current).setView(BARCELONA_CENTER, 13);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        map.on('click', (event) => {
          const { lat, lng } = event.latlng;
          const nextLat = lat.toFixed(6);
          const nextLng = lng.toFixed(6);
          setProfileRestaurantRequestLat(nextLat);
          setProfileRestaurantRequestLng(nextLng);
          setProfileRestaurantMapError('');
          placeProfileRequestMarker(lat, lng, { flyTo: false });
          reverseGeocodeProfileRestaurantRequest(nextLat, nextLng);
        });

        profileRequestMapInstanceRef.current = map;

        if (profileRestaurantRequestLat && profileRestaurantRequestLng) {
          placeProfileRequestMarker(Number(profileRestaurantRequestLat), Number(profileRestaurantRequestLng), { flyTo: true });
        }

        setTimeout(() => {
          map.invalidateSize();
        }, 0);
      } catch {
        setProfileRestaurantMapError('No se pudo cargar el mapa de direccion.');
      }
    };

    initProfileRequestMap();

    return () => {
      cancelled = true;
    };
  }, [
    isLoggedIn,
    adminView,
    adminModalOpen,
    profileRestaurantRequestLat,
    profileRestaurantRequestLng,
    placeProfileRequestMarker,
    reverseGeocodeProfileRestaurantRequest,
  ]);

  useEffect(() => {
    if (!profileRequestMapInstanceRef.current || !window.L) return;
    const lat = Number(profileRestaurantRequestLat);
    const lng = Number(profileRestaurantRequestLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    placeProfileRequestMarker(lat, lng, { flyTo: false });
  }, [profileRestaurantRequestLat, profileRestaurantRequestLng, placeProfileRequestMarker]);

  useEffect(() => {
    const shouldShowProfileMap = isLoggedIn && adminView === 'profile' && !adminModalOpen;
    if (shouldShowProfileMap) return;

    if (profileRequestMapInstanceRef.current) {
      profileRequestMapInstanceRef.current.off();
      profileRequestMapInstanceRef.current.remove();
      profileRequestMapInstanceRef.current = null;
    }
    profileRequestMarkerRef.current = null;
  }, [isLoggedIn, adminView, adminModalOpen]);

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setRequestAccessMessage('');
  };

  const openAuthModal = (mode) => {
    switchAuthMode(mode);
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
            aria-label="Abrir o cerrar menÃº lateral"
            aria-expanded={isMenuOpen}
            aria-controls="left-sidebar-menu"
          >
            ☰
          </button>
        )}
        <img src={logo} className="top-bar-logo" alt="Logo Joviat" />
        {isLoggedIn && (
          <div className="top-bar-user" title={authUserEmail}>
            {!isAdmin && (
              <img
                src={authUserPhoto || defaultAvatar}
                alt="Avatar usuario"
                className="top-bar-avatar"
              />
            )}
            <p className="top-bar-email">{authUserEmail}</p>
          </div>
        )}
      </header>

      <aside
        id="left-sidebar-menu"
        className={`left-sidebar ${isSidebarVisible ? 'open' : ''}`}
        aria-hidden={!isSidebarVisible}
      >
        <div className="language-panel">
          <label htmlFor="language-select" className="language-label">{uiText.language}</label>
          <select
            id="language-select"
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <h2 className="sidebar-title">{uiText.menuTitle}</h2>
        <nav>
          <ul className="sidebar-links">
            <li>
              <button
                type="button"
                className={`sidebar-button ${isSidebarButtonActive('home') ? 'active' : ''}`}
                onClick={() => handleSectionChange('home')}
              >
                {uiText.home}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${isSidebarButtonActive('students') ? 'active' : ''}`}
                onClick={() => handleSectionChange('students')}
              >
                {uiText.students}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`sidebar-button ${isSidebarButtonActive('shops') ? 'active' : ''}`}
                onClick={() => handleSectionChange('shops')}
              >
                {uiText.shops}
              </button>
            </li>
            {isLoggedIn && !isAdmin && (
              <li>
                <button
                  type="button"
                  className={`sidebar-button ${isSidebarButtonActive('profile') ? 'active' : ''}`}
                  onClick={openProfileView}
                >
                  {uiText.editProfile}
                </button>
              </li>
            )}
            {isAdmin && (
              <>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${isSidebarButtonActive('student') ? 'active' : ''}`}
                    onClick={() => openAdminModal('student')}
                  >
                    {uiText.addStudent}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${isSidebarButtonActive('restaurant') ? 'active' : ''}`}
                    onClick={() => openAdminModal('restaurant')}
                  >
                    {uiText.addShop}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${isSidebarButtonActive('profile') ? 'active' : ''}`}
                    onClick={openProfileView}
                  >
                    {uiText.editProfile}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`sidebar-button ${isSidebarButtonActive('manage') ? 'active' : ''}`}
                    onClick={openManageView}
                  >
                    {uiText.manageRequests}
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
              {uiText.logout}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="auth-button"
                onClick={() => openAuthModal('login')}
              >
                {uiText.login}
              </button>
              <button
                type="button"
                className="auth-button auth-button-secondary"
                onClick={() => openAuthModal('request')}
              >
                {uiText.requestAccess}
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
                      ? 'Editar restaurante'
                      : 'Crear restaurante'}
                </h2>
                <p>
                  {adminModalType === 'student'
                    ? adminMode === 'edit'
                      ? 'Actualiza los datos del alumno y revisa su informacion.'
                      : 'Registra un nuevo alumno y verifica su informacion.'
                    : adminMode === 'edit'
                      ? 'Actualiza los datos del restaurante y revisa los detalles.'
                      : 'Registra un nuevo restaurante y completa los datos clave.'}
                </p>
              </div>
            </div>
            <div className="admin-form-layout">
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h3>{adminModalType === 'student' ? 'Datos personales' : 'Datos del restaurante'}</h3>
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
              Restaurante
            </label>
            <select
              id={`relation-restaurant-${index}`}
              className="admin-input"
              value={relation.restaurantId}
              onChange={(event) => updateRelationRow(index, { restaurantId: event.target.value })}
            >
              <option value="">Selecciona un restaurante</option>
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
                          Lat: {newRestaurantLat} Â· Lng: {newRestaurantLng}
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
                            : 'Guardar restaurante'}
                      </button>
                    </div>
                  </>
                )}
              </div>
              
            </div>
          </div>
        )}
        {!adminView && activeSection === 'home' && (
          <HomeView
            onExploreStudents={() => handleSectionChange('students')}
            onExploreShops={() => handleSectionChange('shops')}
            language={language}
          />
        )}
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
        {isAdmin && adminView === 'manage' && !adminModalOpen && (
          <section className="admin-form-shell">
            <div className="admin-form-header">
              <div className="admin-form-heading">
                <h2>Gestionar altas</h2>
                <p>Revisa solicitudes de acceso y altas de alumnos registradas en Firebase.</p>
              </div>
            </div>
            {manageError && <p className="auth-error">{manageError}</p>}
            <div className="admin-form-layout">
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h3>Solicitudes pendientes</h3>
                </div>
                {manageLoading ? (
                  <p>Cargando solicitudes...</p>
                ) : (
                  <>
                    {accessRequests.filter((request) => request.status === 'pending').length === 0 ? (
                      <p>No hay solicitudes pendientes.</p>
                    ) : (
                      <ul className="manage-list">
                        {accessRequests
                          .filter((request) => request.status === 'pending')
                          .map((request) => (
                            <li key={request.id} className="manage-item">
                              <div>
                                <p className="manage-item-title">{request.fullName || 'Sin nombre'}</p>
                                <p className="manage-item-meta">{request.email}</p>
                              </div>
                              <div className="manage-item-actions">
                                <button
                                  type="button"
                                  className="auth-submit"
                                  onClick={() => handleAccessRequestReview(request, 'approved')}
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="admin-remove-row"
                                  onClick={() => handleAccessRequestReview(request, 'rejected')}
                                >
                                  Rechazar
                                </button>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h3>Solicitudes de restaurantes</h3>
                </div>
                {manageLoading ? (
                  <p>Cargando solicitudes de restaurantes...</p>
                ) : (
                  <>
                    {restaurantRequests.filter((request) => request.status === 'pending').length === 0 ? (
                      <p>No hay solicitudes de restaurantes pendientes.</p>
                    ) : (
                      <ul className="manage-list">
                        {restaurantRequests
                          .filter((request) => request.status === 'pending')
                          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
                          .map((request) => (
                            <li key={request.id} className="manage-item">
                              <div>
                                <p className="manage-item-title">{request.restaurantName || 'Sin nombre'}</p>
                                <p className="manage-item-meta">{request.restaurantAddress || '-'}</p>
                                <p className="manage-item-meta">
                                  Solicita: {request.requesterName || 'Sin nombre'} ({request.requesterEmail || '-'})
                                </p>
                              </div>
                              <div className="manage-item-actions">
                                <button
                                  type="button"
                                  className="auth-submit"
                                  onClick={() => handleRestaurantRequestReview(request, 'approved')}
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="admin-remove-row"
                                  onClick={() => handleRestaurantRequestReview(request, 'rejected')}
                                >
                                  Rechazar
                                </button>
                              </div>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h3>Altas de alumnos</h3>
                </div>
                {manageLoading ? (
                  <p>Cargando altas...</p>
                ) : (
                  <>
                    {studentSignups.length === 0 ? (
                      <p>No hay altas registradas.</p>
                    ) : (
                      <ul className="manage-list">
                        {studentSignups
                          .slice()
                          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
                          .map((signup) => (
                            <li key={signup.id} className="manage-item">
                              <div>
                                <p className="manage-item-title">{signup.name}</p>
                                <p className="manage-item-meta">{signup.email}</p>
                              </div>
                              <p className={`manage-status manage-status-${signup.status || 'pending'}`}>
                                {signup.status || 'pending'}
                              </p>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                )}
                <div className="admin-form-actions">
                  <button type="button" className="auth-submit" onClick={() => openAdminModal('student')}>
                    Alta nuevo alumno
                  </button>
                  <button type="button" className="auth-submit" onClick={() => openAdminModal('restaurant')}>
                    Alta nuevo restaurante
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {isLoggedIn && adminView === 'profile' && !adminModalOpen && (
          <section className="admin-form-shell">
            <div className="admin-form-header">
              <div className="admin-form-heading">
                <h2>Editar perfil</h2>
                <p>Actualiza tus datos personales y de contacto.</p>
              </div>
            </div>
            {profileError && <p className="auth-error">{profileError}</p>}
            {profileMessage && <p className="manage-status manage-status-approved">{profileMessage}</p>}
            <div className="admin-form-layout">
              <div className="admin-form-card">
                {profileLoading ? (
                  <p>Cargando perfil...</p>
                ) : (
                  <>
                    <label className="admin-label" htmlFor="profile-name">Nombre completo</label>
                    <input
                      id="profile-name"
                      className="admin-input"
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                    <label className="admin-label" htmlFor="profile-email">Email</label>
                    <input
                      id="profile-email"
                      className="admin-input"
                      type="email"
                      value={authUserEmail}
                      disabled
                    />
                    <label className="admin-label" htmlFor="profile-linkedin">LinkedIn</label>
                    <input
                      id="profile-linkedin"
                      className="admin-input"
                      type="text"
                      value={profileLinkedIn}
                      onChange={(event) => setProfileLinkedIn(event.target.value)}
                    />
                    <label className="admin-label" htmlFor="profile-photo">Photo URL</label>
                    <input
                      id="profile-photo"
                      className="admin-input"
                      type="text"
                      value={profilePhoto}
                      onChange={(event) => setProfilePhoto(event.target.value)}
                    />
                    <label className="admin-label" htmlFor="profile-phone-0">Telefono</label>
                    <div className="admin-phone-list">
                      {profilePhones.map((phone, index) => (
                        <div key={`profile-phone-${index}`} className="admin-phone-row">
                          <input
                            id={`profile-phone-${index}`}
                            className="admin-input"
                            type="text"
                            value={phone}
                            onChange={(event) => handleProfilePhoneChange(index, event.target.value)}
                          />
                          {profilePhones.length > 1 && (
                            <button
                              type="button"
                              className="admin-remove-row"
                              onClick={() => handleRemoveProfilePhone(index)}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="admin-add-row" onClick={handleAddProfilePhone}>
                        + Anadir telefono
                      </button>
                    </div>
                    <div className="admin-toggle">
                      <div>
                        <p className="admin-toggle-title">Estado alumni</p>
                        <p className="admin-toggle-subtitle">Indica si estas actualmente en la red alumni.</p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={profileAlumni}
                          onChange={(event) => setProfileAlumni(event.target.checked)}
                        />
                        <span className="slider" />
                      </label>
                    </div>
                    <div className="admin-form-section">
                      <div className="admin-form-section-header">
                        <h4>Trabajo en restaurantes</h4>
                        <button
                          type="button"
                          className="admin-add-row"
                          onClick={handleAddProfileRelationRow}
                        >
                          + Anadir restaurante
                        </button>
                      </div>
                      {profileRelations.length === 0 ? (
                        <p>No tienes relaciones registradas.</p>
                      ) : (
                        profileRelations.map((relation, index) => (
                          <div
                            key={relation.id ? `profile-relation-${relation.id}` : `profile-relation-${index}`}
                            className="admin-relation-row"
                          >
                            <div className="admin-relation-field">
                              <label className="admin-label" htmlFor={`profile-relation-restaurant-${index}`}>
                                Restaurante
                              </label>
                              <select
                                id={`profile-relation-restaurant-${index}`}
                                className="admin-input"
                                value={relation.restaurantId}
                                onChange={(event) => updateProfileRelationRow(index, { restaurantId: event.target.value })}
                              >
                                <option value="">Selecciona un restaurante</option>
                                {restaurantsOptions.map((restaurant) => (
                                  <option key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="admin-relation-field">
                              <label className="admin-label" htmlFor={`profile-relation-role-${index}`}>
                                Rol
                              </label>
                              <input
                                id={`profile-relation-role-${index}`}
                                className="admin-input"
                                type="text"
                                placeholder="Cocinero/a"
                                value={relation.role}
                                onChange={(event) => updateProfileRelationRow(index, { role: event.target.value })}
                              />
                            </div>
                            <label className="admin-relation-toggle">
                              <input
                                type="checkbox"
                                checked={relation.currentJob}
                                onChange={(event) => updateProfileRelationRow(index, { currentJob: event.target.checked })}
                              />
                              Trabajo actual
                            </label>
                            {(relation.isExisting || profileRelations.length > 1) && (
                              <button
                                type="button"
                                className="admin-remove-row"
                                onClick={() => handleRemoveProfileRelationRow(index)}
                              >
                                {relation.isExisting ? 'Eliminar' : 'Quitar'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="admin-form-section">
                      <div className="admin-form-section-header">
                        <h4>Solicitar restaurante</h4>
                      </div>
                      <label className="admin-label" htmlFor="profile-request-restaurant-name">Nombre</label>
                      <input
                        id="profile-request-restaurant-name"
                        className="admin-input"
                        type="text"
                        placeholder="Nombre del restaurante"
                        value={profileRestaurantRequestName}
                        onChange={(event) => setProfileRestaurantRequestName(event.target.value)}
                      />
                      <div className="admin-grid">
                        <div>
                          <label className="admin-label" htmlFor="profile-request-restaurant-address">Direccion</label>
                          <input
                            id="profile-request-restaurant-address"
                            className="admin-input"
                            type="text"
                            placeholder="Calle Principal, 12"
                            value={profileRestaurantRequestAddress}
                            onChange={(event) => {
                              setProfileRestaurantRequestAddress(event.target.value);
                              setProfileRestaurantMapError('');
                            }}
                          />
                        </div>
                        <div>
                          <label className="admin-label" htmlFor="profile-request-restaurant-phone">Telefono</label>
                          <input
                            id="profile-request-restaurant-phone"
                            className="admin-input"
                            type="text"
                            placeholder="612 25 49 25"
                            value={profileRestaurantRequestPhone}
                            onChange={(event) => setProfileRestaurantRequestPhone(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="admin-map-section">
                        <div className="admin-map-search-row">
                          <button
                            type="button"
                            className="admin-map-search-button"
                            onClick={handleProfileRestaurantMapSearch}
                            disabled={profileRestaurantMapSearchLoading}
                          >
                            {profileRestaurantMapSearchLoading ? 'Buscando...' : 'Ubicar direccion en mapa'}
                          </button>
                        </div>
                        <p className="admin-map-hint">
                          Puedes marcar la direccion haciendo click en el mapa o buscando la direccion escrita.
                        </p>
                        <div className="admin-map" ref={profileRequestMapRef} />
                        {profileRestaurantRequestLat && profileRestaurantRequestLng && (
                          <p className="admin-map-coords">
                            Lat: {profileRestaurantRequestLat} · Lng: {profileRestaurantRequestLng}
                          </p>
                        )}
                        {profileRestaurantMapError && <p className="auth-error">{profileRestaurantMapError}</p>}
                      </div>
                      <label className="admin-label" htmlFor="profile-request-restaurant-notes">Notas</label>
                      <textarea
                        id="profile-request-restaurant-notes"
                        className="admin-input"
                        rows={3}
                        placeholder="Comentario opcional para el equipo admin"
                        value={profileRestaurantRequestNotes}
                        onChange={(event) => setProfileRestaurantRequestNotes(event.target.value)}
                      />
                      {profileRestaurantRequestError && <p className="auth-error">{profileRestaurantRequestError}</p>}
                      {profileRestaurantRequestMessage && (
                        <p className="manage-status manage-status-approved">{profileRestaurantRequestMessage}</p>
                      )}
                      <div className="admin-form-actions">
                        <button
                          type="button"
                          className="auth-submit"
                          onClick={handleProfileRestaurantRequestSubmit}
                          disabled={profileRestaurantRequestLoading}
                        >
                          {profileRestaurantRequestLoading ? 'Enviando...' : 'Enviar solicitud'}
                        </button>
                      </div>
                    </div>
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        className="auth-submit"
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                      >
                        {profileSaving ? 'Guardando...' : 'Guardar perfil'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      {isAuthOpen && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <div className="auth-modal-header">
              <h2>
                {authMode === 'register'
                  ? 'Crear cuenta'
                  : authMode === 'request'
                    ? 'Solicitar acceso'
                    : 'Iniciar sesion'}
              </h2>
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
                onClick={() => switchAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'request' ? 'active' : ''}`}
                onClick={() => switchAuthMode('request')}
              >
                Solicitar acceso
              </button>
            </div>
            {authMode === 'request' ? (
              <>
                <label htmlFor="request-access-email" className="search-label">Correo</label>
                <input
                  id="request-access-email"
                  type="email"
                  className="search-input"
                  placeholder="correo@dominio.com"
                  value={requestAccessEmail}
                  onChange={(event) => setRequestAccessEmail(event.target.value)}
                />
                <label htmlFor="request-access-name" className="search-label">Nombre y apellidos</label>
                <input
                  id="request-access-name"
                  type="text"
                  className="search-input"
                  placeholder="Nombre Apellidos"
                  value={requestAccessName}
                  onChange={(event) => setRequestAccessName(event.target.value)}
                />
              </>
            ) : (
              <>
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
              </>
            )}
            {requestAccessMessage && <p className="manage-status manage-status-approved">{requestAccessMessage}</p>}
            {authError && <p className="auth-error">{authError}</p>}
            <button
              type="button"
              className="auth-submit"
              onClick={authMode === 'request' ? handleRequestAccess : handleAuthCheck}
              disabled={authMode === 'request' ? requestAccessLoading : authLoading}
            >
              {(authMode === 'request' ? requestAccessLoading : authLoading)
                ? 'Comprobando...'
                : authMode === 'register'
                  ? 'Registrarse'
                  : authMode === 'request'
                    ? 'Enviar solicitud'
                    : 'Entrar'}
            </button>
          </div>
        </div>
      )}
      {mustChangePasswordOpen && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <div className="auth-modal-header">
              <h2>Cambio obligatorio de contrasena</h2>
            </div>
            <p className="admin-map-hint">
              Es tu primer acceso. Debes cambiar la contrasena provisional para continuar.
            </p>
            <label htmlFor="required-password" className="search-label">Nueva contrasena</label>
            <input
              id="required-password"
              type="password"
              className="search-input"
              placeholder="Minimo 6 caracteres"
              value={mustChangePasswordValue}
              onChange={(event) => setMustChangePasswordValue(event.target.value)}
            />
            <label htmlFor="required-password-confirm" className="search-label">Confirmar contrasena</label>
            <input
              id="required-password-confirm"
              type="password"
              className="search-input"
              placeholder="Repite la contrasena"
              value={mustChangePasswordConfirm}
              onChange={(event) => setMustChangePasswordConfirm(event.target.value)}
            />
            {mustChangePasswordError && <p className="auth-error">{mustChangePasswordError}</p>}
            <button
              type="button"
              className="auth-submit"
              onClick={handleRequiredPasswordChange}
              disabled={mustChangePasswordLoading}
            >
              {mustChangePasswordLoading ? 'Guardando...' : 'Guardar nueva contrasena'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
