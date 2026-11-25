const mongoose = require('mongoose')
const recipes = require('../models/recipeModel')

const pickRecipeFields = (body) => {
    const {
        name, ingredients, instructions, prepTimeMinutes, cookTimeMinutes, servings,
        difficulty, cuisine, caloriesPerServing, image, mealType
    } = body
    return {
        name, ingredients, instructions, prepTimeMinutes, cookTimeMinutes, servings,
        difficulty, cuisine, caloriesPerServing, image, mealType
    }
}

exports.getRecipes = async (req, res) => {
    const response = await recipes.find()
    res.status(200).json({ message: 'all recipes fetched', response })
}

exports.viewRecipe = async (req, res) => {
    const recipe = await recipes.findById(req.params.id)
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' })
    }
    res.status(200).json(recipe)
}

exports.getRelatedRecipe = async (req, res) => {
    const related = await recipes.find({ cuisine: req.query.cuisine })
    res.status(200).json(related)
}

exports.addRecipe = async (req, res) => {
    const fields = pickRecipeFields(req.body)

    const existingRecipe = await recipes.findOne({ name: fields.name })
    if (existingRecipe) {
        return res.status(409).json({ message: 'Recipe already exists' })
    }

    const newRecipe = await recipes.create(fields)
    res.status(201).json({ message: 'Recipe added', newRecipe })
}

exports.updateRecipe = async (req, res) => {
    const { id } = req.params
    const fields = pickRecipeFields(req.body)

    // Prevent a duplicate name (excluding the recipe being edited).
    // sanitizeFilter is on, so server-built operators must be marked as trusted.
    const existingRecipe = await recipes.findOne({
        name: fields.name,
        _id: mongoose.trusted({ $ne: id })
    })
    if (existingRecipe) {
        return res.status(409).json({ message: 'Recipe name already exists' })
    }

    const updatedRecipe = await recipes.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true })
    if (!updatedRecipe) {
        return res.status(404).json({ message: 'Recipe not found' })
    }

    res.status(200).json({ message: 'Recipe updated successfully', updatedRecipe })
}

exports.deleteRecipe = async (req, res) => {
    const deleted = await recipes.findByIdAndDelete(req.params.id)
    if (!deleted) {
        return res.status(404).json({ message: 'Recipe not found' })
    }
    res.status(200).json({ message: 'Deleted recipe' })
}
