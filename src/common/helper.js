/**
 * Contains generic helper methods
 */
const _ = require('lodash')
const axios = require('axios')
const config = require('config')
const qs = require('querystring')
const m2mAuth = require('tc-core-library-js').auth.m2m
const logger = require('./logger')

const ubahnM2MConfig = _.pick(config, ['AUTH0_URL', 'AUTH0_UBAHN_AUDIENCE', 'AUTH0_PROXY_SERVER_URL'])
const topcoderM2MConfig = _.pick(config, ['AUTH0_URL', 'AUTH0_TOPCODER_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])

const ubahnM2M = m2mAuth({ ...ubahnM2MConfig, AUTH0_AUDIENCE: ubahnM2MConfig.AUTH0_UBAHN_AUDIENCE })
const topcoderM2M = m2mAuth({ ...topcoderM2MConfig, AUTH0_AUDIENCE: topcoderM2MConfig.AUTH0_TOPCODER_AUDIENCE })

/**
 * Use this function to halt execution
 * js version of sleep()
 * @param {Number} ms Timeout in ms
 */
async function sleep (ms) {
  if (!ms) {
    ms = config.SLEEP_TIME
  }

  logger.debug(`Sleeping for ${ms} ms`)

  return new Promise(resolve => setTimeout(resolve, ms))
}

/* Function to get M2M token
 * (U-Bahn APIs only)
 * @returns {Promise}
 */
async function getUbahnM2Mtoken () {
  return ubahnM2M.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/* Function to get M2M token
 * (Topcoder APIs only)
 * @returns {Promise}
 */
async function getTopcoderM2Mtoken () {
  return topcoderM2M.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/**
 * Get Kafka options
 * @return {Object} the Kafka options
 */
function getKafkaOptions () {
  const options = { connectionString: config.KAFKA_URL, groupId: config.KAFKA_GROUP_ID }
  if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
    options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
  }
  return options
}

/**
 * Function to get data from ubahn api
 * Call function ONLY IF you are sure that record indeed exists
 * If more than one record exists, then it will attempt to return the one that matches param
 * Else will throw error
 * @param {String} path api path
 * @param {Object} params query params
 * @param {String} token u-bahn apis token
 * @returns {Promise} the record or null
 */
async function getUbahnSingleRecord (path, params, token) {
  logger.debug(`request GET ${path} by params: ${JSON.stringify(params)}`)
  try {
    const res = await axios.get(`${config.UBAHN_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
      validateStatus: (status) => {
        if (status === 404) {
          // If record is not found, it is not an error in scenario where we are checking
          // if record exists or not
          return true
        }
        return status >= 200 && status < 300
      }
    })

    if (_.isArray(res.data)) {
      if (res.data.length === 1) {
        return res.data[0]
      }
      if (res.data.length === 0) {
        return null
      }
      if (res.data.length > 1) {
        return _.find(res.data, params)
      }
    } else {
      return res.data
    }
  } catch (err) {
    logger.error(`get ${path} by params: ${JSON.stringify(params)} failed`)
    logger.error(err)
    throw Error(`get ${path} by params: ${JSON.stringify(params)} failed`)
  }
}

/**
 * Function to post data to ubahn api to create ubahn record
 * @param {String} path api path
 * @param {Object} data request body
 * @param {String} token u-bahn apis token
 * @returns {Promise} the created record
 */
async function createUbahnRecord (path, data, token) {
  logger.debug(`request POST ${path} with data: ${JSON.stringify(data)}`)
  try {
    const res = await axios.post(`${config.UBAHN_API_URL}${path}`, data, { headers: { Authorization: `Bearer ${token}` } })

    await sleep()

    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`post ${path} with data: ${JSON.stringify(data)} failed`)
  }
}

/**
 * Function to patch data to ubahn api to update ubahn record
 * @param {String} path api path
 * @param {Object} data request body
 * @param {String} token u-bahn apis token
 * @returns {Promise} the updated record
 */
async function updateUBahnRecord (path, data, token) {
  logger.debug(`request PATCH ${path} with data: ${JSON.stringify(data)}`)
  try {
    const res = await axios.patch(`${config.UBAHN_API_URL}${path}`, data, { headers: { Authorization: `Bearer ${token}` } })

    await sleep()

    return res.data
  } catch (err) {
    logger.error(err)
    throw Error(`patch ${path} with data: ${JSON.stringify(data)} failed`)
  }
}

/**
 * Function to get user skills
 * @param {String} handle user handle
 * @param {String} token topcoder apis token
 * @returns {Promise} user skills
 */
async function getMemberSkills (handle, token) {
  logger.debug(`request GET User Skills by handle: ${handle}`)
  const url = `${config.MEMBERS_API_URL}/${qs.escape(handle)}/skills`
  try {
    const res = await axios.get(url, {
      params: {
        fields: 'skills'
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const { skills } = res.data

    const skillDetails = Object.keys(skills).map(key => ({
      name: skills[key].tagName,
      score: skills[key].score
    }))

    return skillDetails
  } catch (error) {
    if (error.response.status === 404) {
      // No skills exist for the user
      return []
    }
    throw error
  }
}

module.exports = {
  getKafkaOptions,
  getTopcoderM2Mtoken,
  getUbahnM2Mtoken,
  getMemberSkills,
  getUbahnSingleRecord,
  createUbahnRecord,
  updateUBahnRecord
}
