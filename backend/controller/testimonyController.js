const testimony=require('../models/testimonyModel')

exports.addTestimony=async (req,res) => {
    const userId = req.userId
    const { username,email,message,profession}=req.body
    try {
        const existingTestimony = await testimony.findOne({email})
        if (existingTestimony) {
                        res.status(400).json({message:"Testimony already exists"})

        } else {
            const newTestimony = new testimony({
                username,email,message,profession
            })
            await newTestimony.save()
            res.status(200).json({message:"Testimony Added Successfully...",newTestimony})
        }
    } catch (error) {
        res.status(500).json({message:"Error",error})
    }
}

exports.getTestimony=async (req,res) => {
    try {
        const allTestimony = await testimony.find()
        res.status(200).json({message:"Testimonies Fetched Successfully...",allTestimony})
    } catch (error) {
        res.status(500).json({message:"Error",error})
    }
}

exports.getApprovedTestimony = async (req, res) => {
  try {

    const approved = await testimony.find({ status: "Approved" });

    res.status(200).json({
      message: "Approved testimonies fetched",
      approved
    });

  } catch (error) {
    res.status(500).json({ message: "Error", error });
  }
};

exports.updateTestimony = async (req, res) => {

    const { id } = req.params;
    const { status } = req.body;

    try {

        const updatedData = await testimony.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        res.status(200).json({
            message: "Updated Successfully...",
            updatedData
        });

    } catch (error) {
        res.status(500).json({ message: "Error", error });
    }
};
