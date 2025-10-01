import Sequelize from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let database = null;

const loadModels = async (sequelize) => {
  const models = {};

  try {
    // Importar models dinamicamente
    const { default: ProductsModel } = await import('./models/produto.js');

    const Products = ProductsModel(sequelize, Sequelize.DataTypes);

    // Adicionar aos models
    models[Products.name] = Products;

    return models;
  } catch (error) {
    console.error('Erro ao carregar models:', error);
    return {};
  }
};

export default async (config) => {
  if (!database) {
    const op = Sequelize.Op;
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.params.host,
        port: config.params.port,
        dialect: config.params.dialect,
        operatorsAliases: op,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      },
    );

    database = {
      sequelize,
      Sequelize,
      models: {},
    };

    database.models = await loadModels(sequelize);

    // Sincronizar com a base de dados
    try {
      await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
      console.log('✅ Sequelize sincronizado com a base de dados');
    } catch (error) {
      console.error('❌ Erro ao sincronizar Sequelize:', error);
      throw error;
    }
  }

  return database;
};
