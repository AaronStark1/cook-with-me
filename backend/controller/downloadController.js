const download = require('../models/downloadModel')

exports.addDownload = async (req, res) => {
    const { id } = req.params
    const userId = req.userId
    const { name, ingredients, instructions, cuisine, image } = req.body
    console.log(userId);

    try {
        const recipe = await download.findOne({ recipeId: id })
        if (recipe) {
            recipe.count++
            await recipe.save()
            res.status(200).json({ message: "Count Incremented", recipe })
        } else {
            const newRecipe = new download({ recipeId: id, name, ingredients, instructions, cuisine, image, count: 1, userId })
            await newRecipe.save()
            res.status(200).json({ message: "Downloaded", newRecipe })
        }
    } catch (err) {
        res.status(500).json(err)
    }
}

exports.getDownload = async (req, res) => {
    const userId = req.userId
    try {
        const downloads = await download.find({ userId })
        res.status(200).json(downloads)
    } catch (err) {
        res.status(500).json(err)
    }
}

exports.deleteDownload = async(req,res) => {
    const {id} = req.params
    try {
        const deleteDownload = await download.findByIdAndDelete({_id:id})
        res.status(200).json({message:"Download deleted",deleteDownload})
    } catch (err) {
        res.status(500).json(err)
    }
}

exports.getDownloadedRecipeList = async (req, res) => {
    try {
        const downloads = await download.find()
        res.status(200).json({message:"Downloaded recipes",downloads})
    } catch (err) {
        res.status(500).json(err)
    }
}