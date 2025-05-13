import axios from 'axios';
 
 // Create axios instance with base URL
 const api = axios.create({
   baseURL: process.env.REACT_APP_API_URL || 'http://localhost:1909', // Match your backend port
 });
 
 // Add request interceptor
 api.interceptors.request.use(
   (config) => {
     const user = JSON.parse(localStorage.getItem('user'));
     if (user?.token) {
       config.headers.Authorization = `Bearer ${user.token}`;
     }
     return config;
   },
   (error) => {
     return Promise.reject(error);
   }
 );
 
 // Add response interceptor
 api.interceptors.response.use(
   (response) => response,
   async (error) => {
     if (error.response?.status === 401) {
       // Clear user data and redirect to login
       localStorage.removeItem('user');
       window.location.href = '/login';
     }
     return Promise.reject(error);
   }
 );
 
 export default api; 