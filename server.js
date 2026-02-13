import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 4173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BMC_BASE = 'https://saas02.tandis.app:8443/api';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function proxyFetch(res, url, options = {}) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const body = await (contentType.includes('application/json') ? response.json() : response.text());
    res.status(response.status);
    if (typeof body === 'string') {
      res.send(body);
    } else {
      res.json(body);
    }
  } catch (error) {
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
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);

  await proxyFetch(res, `${BMC_BASE}/jwt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
});

app.post('/api/orders', async (req, res) => {
  const { token, limit = 10 } = req.body;
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
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order?fields=${fields}&limit=${limit}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-services', async (req, res) => {
  const { token, orderId } = req.body;
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
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:Service?fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-tasks', async (req, res) => {
  const { token, orderId } = req.body;
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
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:ServiceTask?fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-materials', async (req, res) => {
  const { token, orderId } = req.body;
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
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:Material?limit=100&fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-attachments-list', async (req, res) => {
  const { token, orderId } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const fields = encodeFields(['Attachment_File', 'Request ID', 'Create Date']);
  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:Attachments?limit=100&q=${query}&fields=${fields}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-attachment-file', async (req, res) => {
  const { token, attachmentId } = req.body;
  if (!token || !attachmentId) {
    return res.status(400).json({ error: 'Missing token or attachmentId' });
  }

  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:Attachments/${attachmentId}/attach/Attachment_File`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `AR-JWT ${token}` }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).send(text);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    ['content-type', 'content-disposition', 'content-length'].forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    });
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Attachment download error:', error);
    res.status(500).json({ error: 'Failed to download attachment.' });
  }
});

app.post('/api/order-comments', async (req, res) => {
  const { token, orderId } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const query = encodeQuery(`'IDOrder'="${orderId}"`);
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:OrderComment?limit=100&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
