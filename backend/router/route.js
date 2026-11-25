const express = require('express')
const recipeController = require('../controller/recipeController')
const userController = require('../controller/userController')
const savedRecipeController = require('../controller/savedRecipeController')
const downloadController = require('../controller/downloadController')
const testimonyController = require('../controller/testimonyController')
const jwtMiddleware = require('../middleware/jwtMiddleware')
const adminMiddleware = require('../middleware/adminMiddleware')
const { loginLimiter, registrationLimiter } = require('../middleware/rateLimiters')
const v = require('../validators')

const route = express.Router()

// Everything under "admin" requires a valid JWT *and* the Admin role.
const admin = [jwtMiddleware, adminMiddleware]

// ---- Public ----
route.get('/api/allRecipes', recipeController.getRecipes)
route.get('/api/viewRecipe/:id', v.id, recipeController.viewRecipe)
route.get('/api/relatedRecipe', v.relatedRecipe, recipeController.getRelatedRecipe)
route.get('/api/getApprovedTestimony', testimonyController.getApprovedTestimony)
route.post('/api/registration', registrationLimiter, v.register, userController.registerUser)
route.post('/api/login', loginLimiter, v.login, userController.loginUser)

// ---- Authenticated users ----
route.patch('/api/updateProfile', jwtMiddleware, v.updateProfile, userController.updateProfile)
route.post('/api/savedRecipe/:id', jwtMiddleware, v.id, savedRecipeController.addSavedRecipe)
route.get('/api/getSavedRecipes', jwtMiddleware, savedRecipeController.getSavedRecipe)
route.delete('/api/deleteSavedRecipe/:id', jwtMiddleware, v.id, savedRecipeController.deleteSavedRecipe)
route.post('/api/addDownload/:id', jwtMiddleware, v.id, downloadController.addDownload)
route.get('/api/getDownload', jwtMiddleware, downloadController.getDownload)
route.delete('/api/deleteDownload/:id', jwtMiddleware, v.id, downloadController.deleteDownload)
route.post('/api/addTestimony', jwtMiddleware, v.addTestimony, testimonyController.addTestimony)

// ---- Admin only ----
route.get('/api/getAllUsers', ...admin, userController.getAllUsers)
route.get('/api/getDownloadedRecipesList', ...admin, downloadController.getDownloadedRecipeList)
route.get('/api/getTestimony', ...admin, testimonyController.getTestimony)
route.patch('/api/updateTestimony/:id', ...admin, v.updateTestimony, testimonyController.updateTestimony)
route.post('/api/addRecipe', ...admin, v.addRecipe, recipeController.addRecipe)
route.put('/api/updateRecipe/:id', ...admin, v.updateRecipe, recipeController.updateRecipe)
route.delete('/api/deleteRecipe/:id', ...admin, v.id, recipeController.deleteRecipe)

module.exports = route
