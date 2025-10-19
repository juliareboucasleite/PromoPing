import dotenv from 'dotenv';

dotenv.config({ silent: true, debug: false, override: false, quiet: true });

export default {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  params: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
  },
};
