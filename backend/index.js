require('dotenv').config()
const express = require('express')
require('./config/db')
const route=require('./router/route')
const cors=require('cors')

const kitchencraft=express()
kitchencraft.use(cors())
kitchencraft.use(express.json())
kitchencraft.use(route)

const PORT=3000||process.env.PORT

kitchencraft.listen(PORT,()=>{
    console.log("server runs on port 3000");
    
})