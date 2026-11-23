const { body, param, query } = require('express-validator')
const validate = require('../middleware/validate')
const { TESTIMONY_STATUSES } = require('../models/testimonyModel')

// Every rule starts with isString().bail() so that objects such as
// {"$ne": null} are rejected before they can reach a query.
const requiredString = (field, label, max = 200) =>
    body(field)
        .isString().withMessage(`${label} is required`).bail()
        .trim()
        .isLength({ min: 1, max }).withMessage(`${label} is required (max ${max} characters)`)

const nonNegativeNumber = (field, label) =>
    body(field)
        .isFloat({ min: 0 }).withMessage(`${label} must be a number of 0 or more`)
        .toFloat()

const stringList = (field, label) => [
    body(field).isArray({ min: 1 }).withMessage(`${label} must be a non-empty list`),
    body(`${field}.*`).isString().bail().trim().notEmpty().withMessage(`${label} cannot contain empty entries`)
]

const idParam = param('id').isMongoId().withMessage('Invalid id')

const username = requiredString('username', 'Username', 50)
const email = body('email')
    .isString().withMessage('A valid email is required').bail()
    .trim()
    .isEmail().withMessage('A valid email is required')

exports.id = [idParam, validate]

exports.register = [
    username,
    email,
    // bcrypt only uses the first 72 bytes of a password
    body('password')
        .isString().withMessage('Password is required').bail()
        .isLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 characters'),
    validate
]

exports.login = [
    requiredString('email', 'Email', 254),
    body('password').isString().notEmpty().withMessage('Password is required'),
    validate
]

exports.updateProfile = [username, email, validate]

const recipeBody = [
    requiredString('name', 'Name'),
    ...stringList('ingredients', 'Ingredients'),
    ...stringList('instructions', 'Instructions'),
    nonNegativeNumber('prepTimeMinutes', 'Preparation time'),
    nonNegativeNumber('cookTimeMinutes', 'Cooking time'),
    nonNegativeNumber('servings', 'Servings'),
    requiredString('difficulty', 'Difficulty', 50),
    requiredString('cuisine', 'Cuisine', 100),
    nonNegativeNumber('caloriesPerServing', 'Calories per serving'),
    requiredString('image', 'Image', 2000),
    ...stringList('mealType', 'Meal type')
]

exports.addRecipe = [...recipeBody, validate]
exports.updateRecipe = [idParam, ...recipeBody, validate]

exports.relatedRecipe = [
    query('cuisine').isString().withMessage('cuisine is required').bail().trim().notEmpty().withMessage('cuisine is required'),
    validate
]

exports.addTestimony = [
    requiredString('message', 'Message', 1000),
    requiredString('profession', 'Profession', 100),
    validate
]

exports.updateTestimony = [
    idParam,
    body('status').isIn(TESTIMONY_STATUSES).withMessage(`Status must be one of: ${TESTIMONY_STATUSES.join(', ')}`),
    validate
]
