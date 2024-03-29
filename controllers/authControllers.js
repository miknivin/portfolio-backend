import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import User from "../models/user.js";
import { getResetPasswordTemplate } from "../utils/emailTemplate.js";
import ErrorHandler from "../utils/errorHandler.js";
import sendEmail from "../utils/sendEmail.js";
import sendTokens from "../utils/sendTokens.js";
import crypto from "crypto"
//register  user /api/v1/register
export const registerUser = catchAsyncErrors(async (req, res, next)=>{
    const {name, email,password} = req.body;
    
    const user =await User.create({
        name, 
        email,
        password
    });

    sendTokens(user,201,res)
})

//login user - /api/v1/login
export const loginUser = catchAsyncErrors(async (req, res, next)=>{
    const {email,password} = req.body;

    if (!email || !password) {
        return next(new ErrorHandler('Please enter email & password',400))
    }
    
    // find user in the database
    const user = await User.findOne({email}).select("+password")

    if (!user) {
        return next(new ErrorHandler('Invalid email or password',401))
    }

    //check if the password is corect
    const isPasswordMatched = await user.comparePassword(password)

    if (!isPasswordMatched) {
        return next(new ErrorHandler('Invalid password',401))
    }

    sendTokens(user,201,res)
});


//forgot password - /api/v1/password/forgot
export const forgotPassword = catchAsyncErrors(async (req, res, next)=>{

    // find user in the database
    const user = await User.findOne({email:req.body.email})

    if (!user) {
        return next(new ErrorHandler('User not found with this email',401))
    }

    //get reset password token
    const resetToken = user.getResetPasswordToken()

    await user.save()

    //create reset password url
    const resetUrl = `${process.env.FRONTEND_URL}/api/v1/password/reset/${resetToken}`;

    const message = getResetPasswordTemplate(user?.name, resetUrl);

    try{
        await sendEmail({
            email: user.email,
            subject:"ShopIT password recovery",
            message
        });

        res.status(200).json({
            message:`Email sent to ${user.email}`
        })
    }
    catch(error){
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire= undefined;

        await user.save();
        return next(new ErrorHandler(error?.message,500));
    }

    //sendTokens(user,200,res)
});

//reset password - /api/v1/password/reset/:token
export const resetPassword = catchAsyncErrors(async (req, res, next)=>{

    //hash the url token
    const resetPasswordToken =  crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire:{$gt:Date.now()}
    })

    if (!user) {
        return next(new ErrorHandler('Password reset token is invalid or has been expired',400))
    }

    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler('Password does not match',400))
    }

    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire= undefined;

    await user.save();

    sendTokens(user,200,res);
});

//logout user - /api/v1/login
export const logoutUser = catchAsyncErrors(async (req, res, next)=>{
    res.cookie("token",null,{
        expires:new Date(Date.now()),
        httpOnly:true
    });

    res.status(200).json({
        message:"Logged Out"
    })
});

//Get current user profile => /api/v1/me

export const getUserProfile = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req?.user?._id);

    res.status(200).json({
        user,
    });
});


//update user password => /api/v1/password/update

export const updatePassword = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req?.user?._id).select("+password");

    //check the previous user password
    const isPasswordMatched =await user.comparePassword(req.body.oldPassword)

    if (!isPasswordMatched) {
        return next(new ErrorHandler('Old Password is incorrect',400))
    }

    user.password = req.body.password;
    user.save();

    res.status(200).json({
        success:true
    });
});



//update user profile => /api/v1/me/update

export const updateProfile = catchAsyncErrors(async (req,res,next)=>{


    const newUserData = {
        name:req.body.name,
        email:req.body.email
    }

    const user = await User.findByIdAndUpdate(req.user._id,newUserData,{
        new: true
    })

    res.status(200).json({
        user
    });
});

//Get all users => /api/v1/admin/users

export const allUsers = catchAsyncErrors(async (req,res,next)=>{

    const users = await User.find()

    res.status(200).json({
        users
    });
});

//Get user details=> /api/v1/admin/users/:id

export const getUserDetails = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User not found with id: ${req.params.id}`))
    }

    res.status(200).json({
        user
    });
});

//update user details for admin => /api/v1/admin/users/:id

export const updateUser = catchAsyncErrors(async (req,res,next)=>{


    const newUserData = {
        name:req.body.name,
        email:req.body.email,
        role:req.body.role
    }

    const user = await User.findByIdAndUpdate(req.params.id,newUserData,{
        new: true
    })

    res.status(200).json({
        user
    });
});

//Delate user=> /api/v1/admin/users/:id

export const deleteUser = catchAsyncErrors(async (req,res,next)=>{
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User not found with id: ${req.params.id}`))
    }

    //To Do - Remove avatar from cloudinary

    await User.deleteOne();

    res.status(200).json({
        user
    });
});