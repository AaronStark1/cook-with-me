const mongoose=require('mongoose')
mongoose.connect(process.env.MONGO_DB)
.then((res)=>console.log("MongoDB connected"))
.catch(err=>console.log("Connection error"))