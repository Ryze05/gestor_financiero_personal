import Joi from 'joi';

export const envValidationSchema = Joi.object({
  DB_HOST: Joi.string().hostname().required(),
  DB_PORT: Joi.number().port().required(),
  DB_NAME: Joi.string().min(1).required(),
  DB_USER: Joi.string().min(1).required(),
  DB_PASSWORD: Joi.string().min(1).required(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql'] })
    .required(),
  PORT: Joi.number().port().default(3001),
  FX_API_URL: Joi.string().uri().optional(),
});
