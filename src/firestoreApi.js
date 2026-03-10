import { firebaseConfig } from './firebaseConfig';

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

const getFieldValue = (field) => {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.geoPointValue !== undefined) return field.geoPointValue;
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

  return documents.map(({ id, fields }) => ({
    id,
    name: getFieldValue(fields.Name) || 'Sin nombre',
    photoUrl: getFieldValue(fields.PhotoURL) || '',
  }));
};

export const getRestaurants = async () => {
  const documents = await fetchCollection('Restaurant');

  return documents
    .map(({ id, fields }) => {
      const location = getFieldValue(fields.Location);
      return {
        id,
        name: getFieldValue(fields.Name) || 'Sin nombre',
        lat: location?.latitude,
        lng: location?.longitude,
      };
    })
    .filter((restaurant) => typeof restaurant.lat === 'number' && typeof restaurant.lng === 'number');
};
