/**
 * Processor Service
 */

const _ = require('lodash')
const Joi = require('@hapi/joi')
const config = require('config')
const logger = require('../common/logger')
const helper = require('../common/helper')

/**
 * Function to sync user skill
 * @param {String} userId the userId
 * @param {Object} skillDetail the skill detail
 * @param {String} skillProviderId the skillProvider id
 * @param {String} token u-bahn apis token
 * @returns {Promise}
 */
async function syncUserSkill (userId, skillDetail, skillProviderId, token) {
  const { score, name } = skillDetail
  const skill = await helper.getUbahnSingleRecord('/skills', { skillProviderId, name }, token)
  if (!skill) {
    throw Error(`Cannot find skill with name ${name} under skill providerId ${skillProviderId}`)
  }
  const existingSkill = await helper.getUbahnSingleRecord(`/users/${userId}/skills/${skill.id}`, {}, token)
  if (!existingSkill || !existingSkill.id) {
    await helper.createUbahnRecord(`/users/${userId}/skills`, { metricValue: _.toString(score), skillId: skill.id }, token)
  } else {
    await helper.updateUBahnRecord(`/users/${userId}/skills/${skill.id}`, { metricValue: _.toString(score) }, token)
  }
}

/**
 * Process sync user skill message
 * @param {Object} message the kafka message
 * @returns {Promise}
 */
async function processSync (message) {
  const { handle } = message.payload
  const tcToken = await helper.getTopcoderM2Mtoken()
  const ubToken = await helper.getUbahnM2Mtoken()
  const skillProvider = await helper.getUbahnSingleRecord('/skillsProviders', { name: config.SKILL_PROVIDER_NAME }, ubToken)
  if (!skillProvider) {
    throw Error(`Cannot find skill provider with name ${config.SKILL_PROVIDER_NAME}`)
  }
  const user = await helper.getUbahnSingleRecord('/users', { handle }, ubToken)
  if (!user) {
    throw Error(`Cannot find user with handle ${handle}`)
  }
  const skillDetails = await helper.getMemberSkills(handle, tcToken)
  for (const skill of skillDetails) {
    await syncUserSkill(user.id, skill, skillProvider.id, ubToken)
  }
}

processSync.schema = {
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    payload: Joi.object().keys({
      id: Joi.string(),
      handle: Joi.string().required(),
      firstName: Joi.string(),
      lastName: Joi.string()
    }).required().unknown(true)
  }).required()
}

module.exports = {
  processSync
}

logger.buildService(module.exports)
