// Tests run against the in-memory store with fast bcrypt and no external services.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_BACKEND: "memory",
  BCRYPT_COST: "4",
  APP_URL: "http://localhost:3000",
  GEMINI_API_KEY: "",
  SMTP_HOST: "",
  DEMO_MODE: "false",
});
