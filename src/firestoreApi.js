import { firebaseConfig } from './firebaseConfig';

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

const getFieldValue = (field) => {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.geoPointValue !== undefined) return field.geoPointValue;
  if (field.arrayValue !== undefined) {
    const values = field.arrayValue.values || [];
    return values.map(getFieldValue);
  }
  if (field.mapValue !== undefined) {
    const mapFields = field.mapValue.fields || {};
    return Object.fromEntries(
      Object.entries(mapFields).map(([key, value]) => [key, getFieldValue(value)])
    );
  }
  return null;
};

const mapFirestoreDocument = (doc) => {
  const fields = doc.fields || {};
  return {
    id: doc.name?.split('/').pop(),
    fields,
  };
};

const fetchCollection = async (collectionName) => {
  const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}?key=${firebaseConfig.apiKey}`);

  if (!response.ok) {
    throw new Error(`No se pudo cargar la colección ${collectionName}.`);
  }

  const data = await response.json();
  const documents = data.documents || [];

  return documents.map(mapFirestoreDocument);
};

export const getStudents = async () => {
  const documents = await fetchCollection('Alumni');

  return documents.map(({ id, fields }) => {
    const details = Object.fromEntries(
      Object.entries(fields || {}).map(([key, value]) => [key, getFieldValue(value)])
    );

    return {
      id,
      name: details.Name || details.name || 'Sin nombre',
      photoUrl: details.PhotoURL || details.PhotoUrl || details.photoUrl || '',
      details,
    };
  });
};

export const getRestaurants = async () => {
  const documents = await fetchCollection('Restaurant');

  return documents.map(({ id, fields }) => {
    const details = Object.fromEntries(
      Object.entries(fields || {}).map(([key, value]) => [key, getFieldValue(value)])
    );
    const location = details.Location;
    return {
      id,
      name: details.Name || details.name || 'Sin nombre',
      photoUrl: details.PhotoURL || details.PhotoUrl || details.photoUrl || '',
      address: details.Address || details.address || '',
      email: details.Email || details.email || '',
      phone: details.Phone || details.phone || '',
      lat: location?.latitude,
      lng: location?.longitude,
      details,
    };
  });
};

export const getRestAlum = async () => {
  const documents = await fetchCollection('Rest-Alum');

  const normalizeId = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  return documents.map(({ id, fields }) => {
    const details = Object.fromEntries(
      Object.entries(fields || {}).map(([key, value]) => [key, getFieldValue(value)])
    );

    return {
      id,
      alumniId: normalizeId(details.id_alumni || details.idAlumni || details.alumniId || ''),
      restaurantId: normalizeId(details.id_restaurant || details.idRestaurant || details.restaurantId || ''),
      role: details.rol || details.role || '',
      currentJob: details.current_job ?? details.currentJob ?? null,
      details,
    };
  });
};
