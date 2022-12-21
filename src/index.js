const fs = require('fs')
const Schema = require('validate')
const { logger, schemaBuilder, utils, printErrors } = require('../lib')

const logLevels = {
  none: 0,
  error: 1,
  warn: 2,
  verbose: 3
}

const validateSchema =  (targetObject, options = {}) => {
  if(!targetObject)
    return logger.error('Missing argument: either targetObject or filePath is required')
  let isPath = typeof targetObject === 'string'
  if(isPath ? !fs.existsSync(targetObject) : typeof targetObject !== 'object')
    return logger.error('Target must be either be an object or a valid filepath')

  if(logLevels[options.logLevel] > 2) {
    logger.info(`Validating schema for: ${JSON.stringify(targetObject)}`)
  }
  try {
    if(options.schemaObj) {
      options.schema = _getSchemaFromObj(options.schemaObj)
    }
    let inputSchema = options.schema || options.schemaPath || `${__dirname}/../examples/schema.json`
    const schema = schemaBuilder.getSchema(inputSchema)
    const content = isPath ? utils.loadContent(targetObject) : targetObject
    const clone = JSON.parse(JSON.stringify(content))
    const misMatches = new Schema(schema).validate(content).map(err => ({path: err.path, message: err.message}))
    const extraFiels = validateExtraFields(clone, schema)
    return printErrors(misMatches, extraFiels, logLevels[options.logLevel])
  } catch (error) {
    logger.error(error)
  }
}

const validateExtraFields = (targetObj, schemaObj) => {
  let extras = []

  const leafNode = (schemaKey, value) => {
    if (!schemaKey) {
      return false;
    } else if ([String, Number, Boolean].includes(schemaKey.type)) {
      return !schemaKey.use || schemaKey.use(value);
    } else {
      return schemaKey.required === 'boolean';
    }
  }

  const _parseTarget = (target, schema, parsedLevel = '') => {
    if (typeof target !== 'object') {
      return
    }

    for(let key in target) {
      let schemaKey = target instanceof Array ? schema[0] : schema[key]
      const nextLevel = parsedLevel ? `${parsedLevel}.${key}` : key
      const value = target[key];
      if(!schemaKey || typeof target[key] !== 'object' && !leafNode(schemaKey, value)) {
        extras.push({ path: nextLevel, message: getMessage(schemaKey, nextLevel)})
      } else {
        _parseTarget(value, schemaKey, nextLevel)
      }
    }
  }

  _parseTarget(targetObj, schemaObj)
  return extras;
}

const getMessage = (schemaKey, nextLevel) => {
  if (schemaKey && schemaKey.message) {
    return schemaKey.message;
  }
  return `${nextLevel} is not present in schema`;
}


const _getSchemaFromObj = (object) => {
  let keyValues = {}
  for(let key in object) {
    if(typeof object[key] === 'object') {
      if(Array.isArray(object[key])) {
        let first = object[key][0]
        keyValues[key] = [
          typeof first === 'object' ? _getSchemaFromObj(first) : {type: typeof first}  
        ]
      } else {
        keyValues[key] = _getSchemaFromObj(object[key])
      }
    } else {
      keyValues[key] = { required: true, type: typeof object[key]}
    }
  }

  return keyValues
}

module.exports = validateSchema
