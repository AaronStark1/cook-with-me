const savedRecipes = require('../models/savedRecipeModel')
const recipes = require('../models/recipeModel')

exports.addSavedRecipe = async (req, res) => {
    const { id } = req.params
    const userId = String(req.userId)

    // Name and image come from the catalogue, not from the client.
    const recipe = await recipes.findById(id)
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' })
    }

    const existingRecipe = await savedRecipes.findOne({ recipeId: id, userId })
    if (existingRecipe) {
        return res.status(409).json({ message: 'Already saved' })
    }

    const newRecipe = await savedRecipes.create({
        recipeId: id,
        name: recipe.name,
        image: recipe.image,
        userId
    })

    res.status(201).json({ message: 'Added to collection', newRecipe })
}

exports.getSavedRecipe = async (req, res) => {
    const saved = await savedRecipes.find({ userId: String(req.userId) })
    res.status(200).json(saved)
}

exports.deleteSavedRecipe = async (req, res) => {
    // Scoped to the caller so nobody can delete another user's records.
    const deleted = await savedRecipes.findOneAndDelete({ _id: req.params.id, userId: String(req.userId) })
    if (!deleted) {
        return res.status(404).json({ message: 'Not found' })
    }
    res.status(200).json({ message: 'Recipe deleted successfully' })
}
