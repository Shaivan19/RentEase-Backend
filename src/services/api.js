// Auth API calls
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/users/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userType', response.data.userType);
    }
    return response;
  },
  signup: (userData) => api.post('/users/signup', userData),
  verifyToken: () => api.get('/profile'),
  resetPassword: (email) => api.post('/users/reset-password-request', { email }),
  resetPasswordWithToken: (token, newPassword) => api.post('/users/reset-password', { token, newPassword }),
  updatePassword: (passwordData) => api.put('/profile/password', passwordData)
}; 