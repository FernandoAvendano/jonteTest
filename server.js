import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 4173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/bmc-token', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await fetch('https://saas02.tandis.app:8443/api/jwt/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error('BMC login error:', error);
    res.status(500).json({ error: 'Failed to contact BMC login endpoint.' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing AR-JWT token' });
  }

  try {
    const response = await fetch('https://saas02.tandis.app:8443/api/arsys/v1/entry/BTS:SOT:Order?fields=values(ID%2COrdernumberShort%2CStatusID%2CStatusName%2CPatient_PersonID%2CPatient_FirstName%2CPatient_LastName%2CClinicName%2CLab_Name%2COrder_Description%2CCreate%20Date%2CModified%20Date)&limit=10', {
      headers: {
        Authorization: `AR-JWT ${token}`,
        Accept: 'application/json'
      }
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error('BMC orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
