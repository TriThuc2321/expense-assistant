const ENV = {
  API_URL: process.env.NEXT_PUBLIC_API_URL,
  COOKIE: {
    ACCESS_TOKEN_NAME:
      process.env.ACCESS_TOKEN_COOKIE_NAME || 'st_access_token',
    REFRESH_TOKEN_NAME:
      process.env.REFRESH_TOKEN_COOKIE_NAME || 'st_refresh_token',
  },
};

export default ENV;
