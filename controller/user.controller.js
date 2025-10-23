const env = require("dotenv").config()
env

const {uservideomodel} = require("../model/user.model")
uservideomodel
const { v4: uuidv4 } = require("uuid");
// const {Resend} = require ("resend")
// const resend = new Resend(process.env.RESEND_API_KEY);


const bcrypt = require('bcryptjs')
const jwt = require("jsonwebtoken")
const saltRound = 10
const cloudinary = require("../utils/cloudinary")
const nodemailer = require("nodemailer");
const crypto = require("crypto");



const Signup = async (req, res) => {
    try {
        console.log(req.body);
        const { username, email, password } = req.body
        if (!username || !email || !password) {
            return res.status(400).send({ message: "All field are mandatory", status: false })
        }
        const hashedpassword = await bcrypt.hash(password, saltRound)
        console.log(hashedpassword);

        const newuser = await uservideomodel.create({ ...req.body, password: hashedpassword })
        if (!newuser) {
            return res.status(402).send({ message: "Unable to create user", status: false })
        }
        return res.status(200).send({ message: 'User created successfully', status: true })
    } catch (error) {
        console.log(error);
        if (error.message.includes("password: Cast to Number failed")) {
            return res.status(500).send({ message: "Password must be a number", status: false })

        }
        if (error.message.includes("E11000 duplicate key error")) {
            return res.status(500).send({ message: "User already exist", status: false })

        }
        return res.status(500).send({ message: error.message, status: false })


    }
}


const Login = async (req, res) => {
    try {
        console.log(req.body);
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).send({ message: "All field are mandatory", status: false })
        }
        const existuser = await uservideomodel.findOne({ email })
        const comparepass = await bcrypt.compare(password, existuser.password)

        console.log(existuser);



        if (existuser && comparepass) {
            const token = await jwt.sign({ email: existuser.email, id: existuser._id }, process.env.JWT_SECRET, { expiresIn:"1d" })
            return res.status(200).send({ message: 'User login successfully', status: true, token })

        }
        return res.status(500).send({ message: 'Invalid user', status: false })

    } catch (error) {
        console.log(error);

        return res.status(500).send({ message: error.message, status: false })


    }


}
const Verifytoken = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        console.log(token);
        if (!token) {
            return res.status(406).send({ message:"Invalid Token", status: false })
        }
        const verify = await jwt.verify(token, process.env.JWT_SECRET)
        if (verify) {
            const user = await uservideomodel.findOne({ email: verify.email })
            return res.status(200).send({ message: 'Token verify', status: true, user })


        }

    } catch (error) {
        console.log(error.message);

        return res.status(500).send({ message:error.message, status: false })




    }


}
const Uploadprofile = async (req, res) => {
    try {
        const { userid } = req.params
        const { image } = req.body
        if (!image) {
            return res.status(406).send({ message: 'Add your profile picture', status: false })

        }
        const uploadimage = await cloudinary.uploader.upload(image)
        console.log(uploadimage.secure_url);
        if (uploadimage) {
            await usermodel.findByIdAndUpdate(
                userid,
                { $set: { profilePicture: uploadimage.secure_url } }
            )

            return res.status(200).send({ message: "Profile picture uploaded", status: true })

        }
    } catch (error) {
         if (error.message.includes("request entity too large")) {
      return res.status(413).send({message:"Image should not exceed 5mb", status:false})     
         
      }





    }


}


const Createroom =  (req, res) => {
    const roomId = uuidv4();
    res.json({ roomId });

}

// const ForgetPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     console.log(email);

//     const user = await uservideomodel.findOne({ email });
//     if (!user) {
//       return res.status(404).send({ message: "User not found", status: false });
//     }

//     const resetToken = crypto.randomBytes(32).toString("hex");
//     user.resetToken = resetToken;
//     user.resetTokenExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
//     await user.save();

//     const resetLink = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: `"Video Conference" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Password Reset Link",
//       html: `
//         <p>You requested a password reset.</p>
//         <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
//         <p>This link will expire in 10 minutes.</p>
//       `,
//     });

//     res.status(200).send({ message: "Reset link sent to your email", status: true });
//   } catch (error) {
//     console.log(error);
//     res.status(500).send({ message: error.message, status: false });
//   }
// };
// const ForgetPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await uservideomodel.findOne({ email });
//     if (!user) {
//       return res.status(404).send({ message: "User not found", status: false });
//     }

//     const resetToken = crypto.randomBytes(32).toString("hex");
//     user.resetToken = resetToken;
//     user.resetTokenExpire = Date.now() + 10 * 60 * 1000; // 10 mins
//     await user.save();

//     const resetLink = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

//     await resend.emails.send({
//       from: 'Video Conference <usmanblessing043@gmail.com>',
//       to: email,
//       subject: 'Password Reset Link',
//       html: `
//         <p>You requested a password reset.</p>
//         <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
//         <p>This link expires in 10 minutes.</p>
//       `,
//     });

//     res.status(200).send({ message: "Reset link sent to your email", status: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ message: error.message, status: false });
//   }
// };


const ForgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await uservideomodel.findOne({ email });
    if (!user) {
      return res.status(404).send({ message: "User not found", status: false });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

    // Configure Brevo SMTP transport
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.BREVO_API_KEY,
      },
    });

    await transporter.sendMail({
      from: `"Video Conference" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Password Reset Link",
      html: `
        <p>You requested a password reset.</p>
        <p>Click <a href="${resetLink}">here</a> to reset your password.</p>
        <p>This link will expire in 10 minutes.</p>
      `,
    });

    res.status(200).send({ message: "Reset link sent to your email", status: true });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message, status: false });
  }
};

// =============== RESET PASSWORD ===============
const Resetpassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await uservideomodel.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send({ message: "Invalid or expired token", status: false });
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    res.status(200).send({ message: "Password reset successful", status: true });
  } catch (error) {
    res.status(500).send({ message: error.message, status: false });
  }
};







module.exports = { Signup, Login, Verifytoken, Uploadprofile , Createroom, ForgetPassword, Resetpassword}