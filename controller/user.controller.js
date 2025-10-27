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
const Brevo = require("@getbrevo/brevo");




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

    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    const sendSmtpEmail = {
  sender: { name: "Video Conference", email: "usmanblessing043@gmail.com" },
  to: [{ email }],
  subject: " Reset Your Video Conference Password",
  htmlContent: `
  <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f4f7; padding: 40px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <div style="background-color: #1db954; color: white; text-align: center; padding: 25px;">
        <h2 style="margin: 0; font-size: 24px;">Video Conference</h2>
      </div>

      <div style="padding: 30px;">
        <h3 style="color: #333;">Hello</h3>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          We received a request to reset your password for your <strong>Video Conference</strong> account.
          Click the button below to reset it. This link will expire in <strong>10 minutes</strong>.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #1db954; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="color: #555; font-size: 15px;">
          If you didn’t request a password reset, you can safely ignore this email.
        </p>

        <p style="margin-top: 30px; color: #888; font-size: 14px; text-align: center;">
          © ${new Date().getFullYear()} Video Conference. All rights reserved.
        </p>
      </div>
    </div>
  </div>
  `
};


    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email sent:", result);
    res.status(200).send({ message: "Reset link sent successfully", status: true });
  } catch (error) {
    console.error("Brevo API error:", error);
    res.status(500).send({ message: "Email failed to send", status: false });
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