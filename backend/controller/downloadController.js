const download = require('../models/downloadModel')
const recipes = require('../models/recipeModel')

exports.addDownload = async (req, res) => {
    const { id } = req.params
    const userId = String(req.userId)

    // Recipe content comes from the catalogue, not from the client.
    const recipe = await recipes.findById(id)
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' })
    }

    // One record per (recipe, user); repeat downloads bump the counter atomically.
    const result = await download.findOneAndUpdate(
        { recipeId: id, userId },
        {
            $inc: { count: 1 },
            $setOnInsert: {
                name: recipe.name,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                cuisine: recipe.cuisine,
                image: recipe.image
            }
        },
        { upsert: true, returnDocument: 'after', includeResultMetadata: true }
    )

    const created = !result.lastErrorObject.updatedExisting
    res.status(created ? 201 : 200).json({
        message: created ? 'Downloaded' : 'Count Incremented',
        download: result.value
    })
}

exports.getDownload = async (req, res) => {
    const downloads = await download.find({ userId: String(req.userId) })
    res.status(200).json(downloads)
}

exports.deleteDownload = async (req, res) => {
    const deleted = await download.findOneAndDelete({ _id: req.params.id, userId: String(req.userId) })
    if (!deleted) {
        return res.status(404).json({ message: 'Not found' })
    }
    res.status(200).json({ message: 'Download deleted' })
}

// Admin view: total downloads per recipe across all users.
exports.getDownloadedRecipeList = async (req, res) => {
    const downloads = await download.aggregate([
        {
            $group: {
                _id: '$recipeId',
                recipeId: { $first: '$recipeId' },
                name: { $first: '$name' },
                cuisine: { $first: '$cuisine' },
                image: { $first: '$image' },
                count: { $sum: '$count' }
            }
        },
        { $sort: { count: -1 } }
    ])
    res.status(200).json({ message: 'Downloaded recipes', downloads })
}
