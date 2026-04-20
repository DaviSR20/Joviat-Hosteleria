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

const buildStringField = (value) => ({ stringValue: value });
const buildBooleanField = (value) => ({ booleanValue: Boolean(value) });
const buildNumberField = (value) => {
  if (Number.isInteger(value)) {
    return { integerValue: value };
  }
  return { doubleValue: value };
};
const buildArrayField = (values) => ({
  arrayValue: { values: values.map((value) => buildStringField(value)) },
});
const buildGeoField = (latitude, longitude) => ({
  geoPointValue: { latitude, longitude },
});

const createDocument = async (collectionName, fields) => {
  const response = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo crear el documento.';
    throw new Error(message);
  }

  return mapFirestoreDocument(data);
};

const updateDocument = async (collectionName, docId, fields) => {
  const fieldPaths = Object.keys(fields);
  if (!fieldPaths.length) {
    throw new Error('No hay campos para actualizar.');
  }

  const params = new URLSearchParams({ key: firebaseConfig.apiKey });
  fieldPaths.forEach((path) => params.append('updateMask.fieldPaths', path));

  const response = await fetch(
    `${FIRESTORE_BASE_URL}/${collectionName}/${docId}?${params.toString()}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'No se pudo actualizar el documento.';
    throw new Error(message);
  }

  return mapFirestoreDocument(data);
};

const deleteDocument = async (collectionName, docId) => {
  const response = await fetch(
    `${FIRESTORE_BASE_URL}/${collectionName}/${docId}?key=${firebaseConfig.apiKey}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    let message = 'No se pudo eliminar el documento.';
    try {
      const data = await response.json();
      message = data?.error?.message || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
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

export const isAdminEmail = async (email) => {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return false;

  const documents = await fetchCollection('Administrator');

  return documents.some(({ id, fields }) => {
    if (String(id).trim().toLowerCase() === normalized) return true;
    const details = Object.fromEntries(
      Object.entries(fields || {}).map(([key, value]) => [key, getFieldValue(value)])
    );
    const candidates = [
      details.Email,
      details.email,
      details.Mail,
      details.mail,
    ];
    return candidates.some(
      (value) => value && String(value).trim().toLowerCase() === normalized
    );
  });
};

export const createStudent = async ({
  name,
  email,
  phone,
  phones,
  photoUrl,
  linkedIn,
  alumni = true,
}) => {
  const fields = {};
  if (name) fields.Name = buildStringField(name);
  if (email) fields.Email = buildStringField(email);
  if (photoUrl) fields.PhotoURL = buildStringField(photoUrl);
  if (linkedIn) fields.LinkedIn = buildStringField(linkedIn);
  const phoneList = Array.isArray(phones) ? phones : [];
  const normalizedPhones = phoneList.length ? phoneList : (phone ? [phone] : []);
  const cleanPhones = normalizedPhones
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (cleanPhones.length) fields.Phone = buildArrayField(cleanPhones);
  fields.Alumni = buildBooleanField(alumni);

  return createDocument('Alumni', fields);
};

export const updateStudent = async ({
  id,
  name,
  email,
  phones,
  photoUrl,
  linkedIn,
  alumni,
}) => {
  const fields = {};
  if (name !== undefined) fields.Name = buildStringField(name);
  if (email !== undefined) fields.Email = buildStringField(email);
  if (photoUrl !== undefined) fields.PhotoURL = buildStringField(photoUrl);
  if (linkedIn !== undefined) fields.LinkedIn = buildStringField(linkedIn);
  if (phones !== undefined) {
    const normalized = Array.isArray(phones) ? phones : [];
    const cleanPhones = normalized
      .map((value) => String(value).trim())
      .filter(Boolean);
    fields.Phone = buildArrayField(cleanPhones);
  }
  if (alumni !== undefined) fields.Alumni = buildBooleanField(alumni);

  return updateDocument('Alumni', id, fields);
};

export const createRestaurant = async ({
  name,
  address,
  email,
  phone,
  photoUrl,
  latitude,
  longitude,
}) => {
  const fields = {};
  if (name) fields.Name = buildStringField(name);
  if (address) fields.Address = buildStringField(address);
  if (email) fields.Email = buildStringField(email);
  if (phone) fields.Phone = buildStringField(phone);
  if (photoUrl) fields.PhotoURL = buildStringField(photoUrl);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    fields.Location = buildGeoField(latitude, longitude);
  }

  return createDocument('Restaurant', fields);
};

export const updateRestaurant = async ({
  id,
  name,
  address,
  email,
  phone,
  photoUrl,
  latitude,
  longitude,
}) => {
  const fields = {};
  if (name !== undefined) fields.Name = buildStringField(name);
  if (address !== undefined) fields.Address = buildStringField(address);
  if (email !== undefined) fields.Email = buildStringField(email);
  if (phone !== undefined) fields.Phone = buildStringField(phone);
  if (photoUrl !== undefined) fields.PhotoURL = buildStringField(photoUrl);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    fields.Location = buildGeoField(latitude, longitude);
  }

  return updateDocument('Restaurant', id, fields);
};

export const createRestAlum = async ({
  alumniId,
  restaurantId,
  role,
  currentJob,
}) => {
  const fields = {
    id_alumni: buildStringField(alumniId),
    id_restaurant: buildStringField(restaurantId),
    current_job: buildBooleanField(Boolean(currentJob)),
  };

  if (role) {
    fields.rol = buildStringField(role);
  }

  return createDocument('Rest-Alum', fields);
};

export const updateRestAlum = async ({
  id,
  alumniId,
  restaurantId,
  role,
  currentJob,
}) => {
  const fields = {};
  if (alumniId !== undefined) fields.id_alumni = buildStringField(alumniId);
  if (restaurantId !== undefined) fields.id_restaurant = buildStringField(restaurantId);
  if (role !== undefined) fields.rol = buildStringField(role);
  if (currentJob !== undefined) fields.current_job = buildBooleanField(Boolean(currentJob));

  return updateDocument('Rest-Alum', id, fields);
};

export const deleteRestAlum = async (id) => {
  if (!id) return;
  return deleteDocument('Rest-Alum', id);
};
