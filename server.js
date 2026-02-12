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

  const fields = encodeURIComponent(
    'values(ID,OrdernumberShort,StatusID,StatusName,Patient_PersonID,Patient_FirstName,Patient_LastName,ClinicName,Lab_Name,Order_Description,Create Date,Modified Date,IDLab,IDLabDepartment,IDLabCurrent,DepartmentName)'
  );
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

  const fields = encodeURIComponent('values(IDOrder,ServiceName,ServiceDescription,Category,Amount,Unit,Price)');
  const query = encodeURIComponent(`'IDOrder'="${orderId}"`);
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:Order:Service?fields=${fields}&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-tasks', async (req, res) => {
  const { token, labId, labDepartmentId } = req.body;
  if (!token || !labId || !labDepartmentId) {
    return res.status(400).json({ error: 'Missing token or order context' });
  }

  const query = `Order_IDLabDepartment="${labDepartmentId}"AND'Order_IDLab'="${labId}"AND'Order_StatusID'>50AND'Order_StatusID'<1000`;
  const fields = encodeURIComponent('values(Order_IDLab,Order_IDLabDepartment,Order_DepartmentName,Order_Description,Task_AssigneeFullName)');
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:OrdetToServiceTask_J?limit=50&q=${encodeURIComponent(query)}&fields=${fields}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.post('/api/order-attachments-list', async (req, res) => {
  const { token, orderId } = req.body;
  if (!token || !orderId) {
    return res.status(400).json({ error: 'Missing token or orderId' });
  }

  const query = encodeURIComponent(`'IDOrder'="${orderId}"`);
  const fields = encodeURIComponent('values(Attachment_File,Request ID,Create Date)');
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

  const query = encodeURIComponent(`'IDOrder'="${orderId}"`);
  const url = `${BMC_BASE}/arsys/v1/entry/BTS:SOT:OrderComment?limit=100&q=${query}`;

  await proxyFetch(res, url, {
    headers: { Authorization: `AR-JWT ${token}`, Accept: 'application/json' }
  });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
