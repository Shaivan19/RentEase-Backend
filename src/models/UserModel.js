const mongoose = require("mongoose")
const Schema = mongoose.Schema

const userSchema = new Schema({
    firstName:{
        type:String
    },
    lastName:{
        type:String
    },
    age:{
        type:Number
    },
    status:{
        tpye:Boolean
    },
    roleId:{
        type:Schema.Types.ObjectId,
        ref:"Role"
    },
    password:{
        type: String
    },
    email:{
        type:String,
        unique: true
    }
})

module.exports = mongoose.model("users",userSchema)
