import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 4173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENVIRONMENT_BASES = {
  production: 'https://tandis.app:8443/api',
  test: 'https://saas02.tandis.app:8443/api'
};

function resolveBase(environment = 'test') {
  return ENVIRONMENT_BASES[environment] || ENVIRONMENT_BASES.test;
}


const REST_DEBUG = process.env.MTANDIS_REST_DEBUG !== '0';

function logRest(event, details = {}) {
  if (!REST_DEBUG) return;
  const payload = Object.entries(details)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  console.log(`[REST] ${event}${payload ? ' ' + payload : ''}`);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function proxyFetch(res, url, options = {}, meta = {}) {
  const start = Date.now();
  const method = options.method || 'GET';
  logRest('REQ', { route: meta.route || '-', environment: meta.environment || '-', method, url });

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const body = await (contentType.includes('application/json') ? response.json() : response.text());

    let messageNumber = null;
    if (Array.isArray(body) && body[0]?.messageNumber != null) {
      messageNumber = body[0].messageNumber;
    } else if (Array.isArray(body?.errors) && body.errors[0]?.messageNumber != null) {
      messageNumber = body.errors[0].messageNumber;
    } else if (body?.messageNumber != null) {
      messageNumber = body.messageNumber;
    }

    logRest('RES', {
      route: meta.route || '-',
      environment: meta.environment || '-',
      status: response.status,
      durationMs: Date.now() - start,
      messageNumber,
      bodyType: typeof body,
    });

    res.status(response.status);
    if (typeof body === 'string') {
      res.send(body);
    } else {
      res.json(body);
    }
  } catch (error) {
    logRest('ERR', {
      route: meta.route || '-',
      environment: meta.environment || '-',
      durationMs: Date.now() - start,
      error: error?.message || String(error),
    });
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to reach Tandis API.' });
  }
}


function encodeFields(fields) {
  return encodeURIComponent(`values(${fields.join(',')})`);
}

function encodeQuery(query) {
  return encodeURIComponent(query);
}

app.post('/api/bmc-token', async (req, res) => {
  const { username, password, environment } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  const base = resolveBase(environment);

  await proxyFetch(res, `${base}/jwt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
});

app.post('/api/orders', async (req, res) => {
  const { token, limit = 10, environment } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing AR-JWT token' });
  }

  const fields = encodeFields([
    'ID',
    'OrdernumberShort',
    'StatusID',
    'StatusName',
    'Patient_PersonID',
    'Patient_FirstName',
    'Patient_LastName',
    'ClinicName',
    'Lab_Name',
    'Order_Description',
    'Create Date',
    'Modified Date',
    'IDLab',
    'IDLabDepartment',
    'IDLabCurrent',
    'DepartmentName',
    'Currency',
    'PriceInSek',
    'OrderPrice'
  ]);
  const { clinicIds, labIds } = req.body;
  let queryParam = '';
  if (Array.isArray(clinicIds) && clinicIds.length > 0) {
    const clinicFilter = clinicIds.map((id) => `'IDClinic'="${id}"`).join(' OR ');
    queryParam = `&q=${encodeQuery(clinicFilter)}`;
  } else if (Array.isArray(labIds) && labIds.length > 0) {
    const labFilter = labIds.map((id) => `'IDLab'="${id}"`).join(' OR ');
    queryParam = `&q=${encodeQuery(labFilter)}`;
  }

  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order?fields=${fields}&limit=${limit}${queryParam}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/orders', environment });
});

app.post('/api/order-services', async (req, res) => {
  const { token, orderId, environment } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const fields = encodeFields([
    'IDOrder',
    'ServiceName',
    'ServiceDescription',
    'Category',
    'Amount',
    'Unit',
    'Price',
    'Currency'
  ]);
  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order:Service?fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/order-services', environment });
});

app.post('/api/order-tasks', async (req, res) => {
  const { token, orderId, environment } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const fields = encodeFields([
    'ID',
    'IDOrder',
    'TaskName',
    'DepartmentName',
    'StatusTask',
    'AssigneeFullName'
  ]);
  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order:ServiceTask?fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/order-tasks', environment });
});

app.post('/api/order-materials', async (req, res) => {
  const { token, orderId, environment } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const fields = encodeFields([
    'IDOrder',
    'MaterialName',
    'MaterialCode',
    'BatchNumber',
    'AmountMaterial',
    'UnitMaterial',
    'MaterialUnitPrice',
    'PriceMaterial',
    'Currency',
    'PriceInSek'
  ]);
  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order:Material?limit=100&fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/order-materials', environment });
});

app.post('/api/order-attachments-list', async (req, res) => {
  const { token, orderId, environment } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const fields = encodeFields(['Attachment_File', 'Request ID', 'Create Date']);
  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order:Attachments?limit=100&q=${query}&fields=${fields}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/order-attachments-list', environment });
});

app.post('/api/order-attachment-file', async (req, res) => {
  const { token, attachmentId, environment } = req.body;
  if (!token || !attachmentId) {
    return res.status(400).json({ error: 'Missing token or attachmentId' });
  }

  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Order:Attachments/${attachmentId}/attach/Attachment_File`;

  const start = Date.now();
  logRest('REQ', { route: '/api/order-attachment-file', environment, method: 'GET', url });

  try {
    const response = await fetch(url, {
      headers: { Authorization: `AR-JWT ${token}` }
    });

    if (!response.ok) {
      const text = await response.text();
      logRest('RES', { route: '/api/order-attachment-file', environment, status: response.status, durationMs: Date.now() - start, bodyType: 'string', sample: text.slice(0, 180) });
      return res.status(response.status).send(text);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    ['content-type', 'content-disposition', 'content-length'].forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });
    logRest('RES', { route: '/api/order-attachment-file', environment, status: 200, durationMs: Date.now() - start, bodyType: 'binary', bytes: buffer.length });
    res.status(200).send(buffer);
  } catch (error) {
    logRest('ERR', { route: '/api/order-attachment-file', environment, durationMs: Date.now() - start, error: error?.message || String(error) });
    console.error('Attachment download error:', error);
    res.status(500).json({ error: 'Failed to download attachment.' });
  }
});

app.post('/api/order-comments', async (req, res) => {
  const { token, orderId, environment } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:OrderComment?limit=100&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/order-comments', environment });
});

app.use(express.static(__dirname));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.post('/api/user-clinics', async (req, res) => {
  const { token, environment, username } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing AR-JWT token' });
  }
  const fields = encodeFields(['IDClinic', 'IDDentist', 'DentistFullName', 'LoginName', 'StatusDentist']);
  const base = resolveBase(environment);
  const query = username ? `&q=${encodeQuery(`'LoginName'="${username}"`)}` : '';
  const url = `${base}/arsys/v1/entry/BTS:SOT:ClinicToDentistRelToDentist_J?fields=${fields}${query}`;
  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/user-clinics', environment });
});

app.post('/api/user-labs', async (req, res) => {
  const { token, environment } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing AR-JWT token' });
  }
  const fields = encodeFields(['ID', 'Name', 'Status', 'IDParentCompany', 'Type']);
  const query = encodeQuery(`'Status'="Active"`);
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS:SOT:Lab?fields=${fields}&q=${query}&limit=50`;
  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/user-labs', environment });
});

app.post('/api/status-transitions', async (req, res) => {
  const { token, environment } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const base = resolveBase(environment);
  const url = `${base}/arsys/v1/entry/BTS%3ASOT%3AStatusTransition?limit=100&fields=${encodeURIComponent('values(FromStatusID,FromStatusName,ToStatusName,ToStatusID)')}&q=${encodeURIComponent("'Status'=\"Active\"")}`;
  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  }, { route: '/api/status-transitions', environment });
});
