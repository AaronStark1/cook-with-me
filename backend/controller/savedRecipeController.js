const savedRecipes = require('../models/savedRecipeModel')

exports.addSavedRecipe = async (req, res) => {
  try {

    const { id } = req.params;
    const userId = req.userId;
    const { name, image } = req.body;

    const existingRecipe = await savedRecipes.findOne({
      recipeId: id,
      userId: userId
    });

    if (existingRecipe) {
      return res.status(401).json({ message: "Already saved" });
    }

    const newRecipe = new savedRecipes({
      recipeId: id,
      name,
      image,
      userId
    });

    await newRecipe.save();

    res.status(200).json({
      message: "Added to collection",
      newRecipe
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};


exports.getSavedRecipe = async (req, res) => {

  try {

    const userId = String(req.userId);

    const getSavedRecipes = await savedRecipes.find({
      userId: userId
    });

    console.log("Querying for:", userId);
    console.log("Saved recipes found:", getSavedRecipes);

    res.status(200).json(getSavedRecipes);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }

};


exports.deleteSavedRecipe=async(req,res)=>{
    try {
        const {id}=req.params
        const newSavedRecipe=await savedRecipes.findByIdAndDelete({id})
        res.status(200).json("Recipe deleted successfully")
    } catch (error) {
        res.status(500).json(error)
    }
}