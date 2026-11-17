const express=require('express')
const recipeController = require('../controller/recipeController')
const userController = require('../controller/userController')
const savedRecipeController = require('../controller/savedRecipeController')
const downloadController = require('../controller/downloadController')
const testimonyController = require('../controller/testimonyController')
const jwtMiddleware = require('../middleware/jwtMiddleware')
const route=express.Router()

route.get('/api/allrecipes',recipeController.getRecipes)
route.post('/api/registration',userController.registerUser)
route.post('/api/login',userController.loginUser)
route.get('/api/viewRecipe/:id',recipeController.viewRecipe)
route.get('/api/relatedRecipe',jwtMiddleware,recipeController.getRelatedRecipe)
route.post('/api/savedRecipe/:id',jwtMiddleware,savedRecipeController.addSavedRecipe)
route.get('/api/getSavedRecipes',jwtMiddleware,savedRecipeController.getSavedRecipe)
route.delete('/api/deleteSavedRecipe/:id',jwtMiddleware,savedRecipeController.deleteSavedRecipe)
route.post('/api/addDownload/:id',jwtMiddleware,downloadController.addDownload)
route.get('/api/getDownload',jwtMiddleware,downloadController.getDownload)
route.delete('/api/deleteDownload/:id',jwtMiddleware,downloadController.deleteDownload)
route.get('/api/getAllUsers',userController.getAllUsers)
route.get('/api/getDownloadedRecipesList',downloadController.getDownloadedRecipeList)
route.post('/api/addTestimony',jwtMiddleware,testimonyController.addTestimony)
route.get('/api/getTestimony',testimonyController.getTestimony)
route.get('/api/getApprovedTestimony', testimonyController.getApprovedTestimony);
route.patch('/api/updateTestimony/:id', testimonyController.updateTestimony);

route.post('/api/addRecipe',recipeController.addRecipe)
route.put('/api/updateRecipe/:id', recipeController.updateRecipe);
route.delete('/api/deleteRecipe/:id',recipeController.deleteRecipe)

module.exports=route