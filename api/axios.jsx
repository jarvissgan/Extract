import axios from "axios";

const axiosInstance = axios.create({ baseURL: process.env.VITE_axiosBaseUrl });

export const addAccessTokenInterceptor = (getAccessTokenSilently) => {
  axiosInstance.interceptors.request.use(async (config) => {
    const token = await getAccessTokenSilently();
    console.log("token: ", token);
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
};
export default axiosInstance;
