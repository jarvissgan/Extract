import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_axiosBaseUrl });

type TokenGetter = () => Promise<string>;
let getToken: TokenGetter | null = null;

// Set by the user provider. The interceptor below is registered only once.
export const setAccessTokenGetter = (getter: TokenGetter | null) => {
  getToken = getter;
};

api.interceptors.request.use(async (config) => {
  if (getToken) {
    const token = await getToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const errorStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

export default api;
