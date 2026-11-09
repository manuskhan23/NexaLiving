// Backend address, fixed at build time (there is no in-app server setting).
// Release/production builds use PRODUCTION_URL. Debug builds (Metro) use the dev PC on the LAN.
export const PRODUCTION_URL = 'https://nexaliving-api.onrender.com';
<<<<<<< HEAD
const DEV_URL = 'http://10.19.86.13:5000';
=======
const DEV_URL = 'http://localhost:5000';
>>>>>>> 93a1f9daa4912644765886edfc9ff372f42a24b2
const __DEV__=true

export const SERVER_URL = __DEV__ ? DEV_URL : PRODUCTION_URL;
export const apiBase = () => `${SERVER_URL}/api/v1`;
