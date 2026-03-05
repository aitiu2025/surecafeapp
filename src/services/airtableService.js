/**
 * Airtable API Service
 * Centralizes all Airtable API interactions.
 * Credentials are loaded from environment variables (VITE_AIRTABLE_API_KEY, VITE_AIRTABLE_BASE_ID).
 */

const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

const authHeaders = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Fetch all records from a table, following Airtable's pagination offset.
 * @param {string} tableName
 * @param {string[]} fields - Optional field names to fetch
 * @param {Object} options - Optional: sort, filterByFormula
 * @returns {Promise<Array>} All records
 */
export async function fetchAllRecords(tableName, fields = [], options = {}) {
  let records = [];
  let offset = null;

  do {
    let url = `${BASE_URL}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (offset) url += `&offset=${offset}`;
    fields.forEach(f => { url += `&fields[]=${encodeURIComponent(f)}`; });
    if (options.sort) {
      options.sort.forEach((s, i) => {
        url += `&sort[${i}][field]=${encodeURIComponent(s.field)}&sort[${i}][direction]=${s.direction || 'asc'}`;
      });
    }
    if (options.filterByFormula) {
      url += `&filterByFormula=${encodeURIComponent(options.filterByFormula)}`;
    }

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Airtable fetch failed [${res.status}]: ${err?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return records;
}

/**
 * Create a new record in a table.
 * @param {string} tableName
 * @param {Object} fields
 * @returns {Promise<Object>} Created record
 */
export async function createRecord(tableName, fields) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Airtable POST failed [${res.status}]: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Update (PATCH) an existing record.
 * @param {string} tableName
 * @param {string} recordId
 * @param {Object} fields
 * @returns {Promise<Object>} Updated record
 */
export async function updateRecord(tableName, recordId, fields) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Airtable PATCH failed [${res.status}]: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Delete a record from a table.
 * @param {string} tableName
 * @param {string} recordId
 * @returns {Promise<Object>}
 */
export async function deleteRecord(tableName, recordId) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}/${recordId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Airtable DELETE failed [${res.status}]: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

// Table name constants
export const TABLES = {
  CANDIDATES: 'Candidates',
  JOB_DESCRIPTIONS: 'Job_Descriptions',
  CANDIDATE_APPLICATIONS: 'candidate_applications',
  CANDIDATE_INTERVIEWS: 'candidate_interviews',
  MATCHED_RESUMES: 'Matched Resumes',
  STATUSES: 'Statuses',
  CLIENTS: 'Clients',
  USERS: 'Users',
};

/**
 * Delete all records in a table matching a filterByFormula.
 * Used for cascading deletes (related records).
 * @param {string} tableName
 * @param {string} filterByFormula  - Airtable formula string, e.g. `{job_id}="recXXX"`
 */
export async function deleteRecordsByFormula(tableName, filterByFormula) {
  const url = `${BASE_URL}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(filterByFormula)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  if (!res.ok) return;
  const data = await res.json();
  for (const record of (data.records || [])) {
    await deleteRecord(tableName, record.id);
  }
}
