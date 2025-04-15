const RoleModel = require("../models/RoleModel");

const getAllRoles = async (req, res) => {
    try {
        const roles = await RoleModel.find();

        res.json({
            message: "Roles retrieved successfully",
            data: roles
        });
    } catch (error) {
        // res.status(500).json({ message: "Error retrieving roles",
        //  error: error.message });
    }
};


const addRole = async(req,res)=>{
    const savedRole =await RoleModel.create(req.body)

    res.json({
        message:"Data saved successfully..",
        data:savedRole
    })
}

const deleteRole =async(req,res)=>{
    const deletedRole =await RoleModel.findByIdAndDelete(req.params.id)

    res.json({
        message:"Data deleted successfully..",
        data:deletedRole
    })
}

const getRoleById =async(req,res)=>{
    const foundRole =await RoleModel.findById(req.params.id)

    res.json({
        message:"Role found by id successfully...",
        data:foundRole
    })
}

module.exports = {
    getAllRoles,addRole,deleteRole,getRoleById
};
