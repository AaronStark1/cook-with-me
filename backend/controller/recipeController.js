const recipes=require('../models/recipeModel')

exports.getRecipes=async(req,res)=>{
    try{
        const response=await recipes.find()
        res.status(200).json({messge:"all recipes fetched",response})
    }
    catch(err){
        res.status(500).json(err)
    }
}
exports.viewRecipe=async(req,res)=>{
    try {
        const {id}=req.params
const viewRes = await recipes.findById(id)
        res.status(200).json(viewRes)
    } catch (err) {
        res.status(500).json("Err"+err)
    }
}

exports.getRelatedRecipe=async(req,res)=>{
    try {
        const cuisine = req.query.cuisine
        const viewRes=await recipes.find({cuisine})
        res.status(200).json(viewRes)
    } catch (err) {
        res.status(500).json("Err"+err)
    }
}

exports.addRecipe=async (req,res) => {
    const {name,ingredients,instructions,prepTimeMinutes,cookTimeMinutes,servings,difficulty,cuisine,caloriesPerServing,image,mealType} = req.body
    try {
        const existingRecipe=await recipes.findOne({name})
        if (existingRecipe) {
            res.status(400).json({messge:"already exist"})
        } else {
            const newRecipe=new recipes({name,ingredients,instructions,prepTimeMinutes,cookTimeMinutes,servings,difficulty,cuisine,caloriesPerServing,image,mealType})
            await newRecipe.save()
            res.status(200).json({messge:"Recipe added",newRecipe})
        }
    } catch (error) {
        res.status(500).json(error)
    }
}
exports.updateRecipe = async (req, res) => {

  const { id } = req.params;

  const {
    name,
    ingredients,
    instructions,
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    difficulty,
    cuisine,
    caloriesPerServing,
    image,
    mealType
  } = req.body;

  try {

    // Optional: Prevent duplicate name (excluding current recipe)
    const existingRecipe = await recipes.findOne({
      name,
      _id: { $ne: id }
    });

    if (existingRecipe) {
      return res.status(400).json({
        message: "Recipe name already exists"
      });
    }

    const updatedRecipe = await recipes.findByIdAndUpdate(
      id,
      {
        name,
        ingredients,
        instructions,
        prepTimeMinutes,
        cookTimeMinutes,
        servings,
        difficulty,
        cuisine,
        caloriesPerServing,
        image,
        mealType
      },
      { new: true } // return updated document
    );

    if (!updatedRecipe) {
      return res.status(404).json({
        message: "Recipe not found"
      });
    }

    res.status(200).json({
      message: "Recipe updated successfully",
      updatedRecipe
    });

  } catch (error) {
    res.status(500).json({
      message: "Error updating recipe",
      error
    });
  }
};

exports.deleteRecipe=async (req,res) => {
    const {id}=req.params
    try {
        await recipes.findByIdAndDelete({_id:id})
        res.status(200).json({message:"Deleted recipe"})
    } catch (error) {
        res.status(500).json(error)
    }
}