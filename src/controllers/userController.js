const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { isValid, isValidBody, validation, parsingFunc, nameRegex, emailRegex, phoneRegex, passRegex, pinRegex } = require('../validations/validator')
const aws = require("aws-sdk");


aws.config.update({
    accessKeyId: "AKIAY3L35MCRVFM24Q7U",
    secretAccessKey: "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",
    region: "ap-south-1"
})


let uploadFile = async (file) => {
    return new Promise(function (resolve, reject) {
        // this function will upload file to aws and return the link
        let s3 = new aws.S3({ apiVersion: '2006-03-01' }); // we will be using the s3 service of aws

        var uploadParams = {
            ACL: "public-read",
            Bucket: "classroom-training-bucket",  //HERE
            Key: "abc/" + file.originalname, //HERE 
            Body: file.buffer
        }

        s3.upload(uploadParams, function (err, data) {
            if (err) {
                return reject({ "error": err })
            }
            // console.log(data)
            console.log("file uploaded succesfully")
            return resolve(data.Location)
        })

    })
}



const createUser = async function (req, res) {
    try {
        let data = req.body;
        if (!isValidBody(data)) return res.status(400).send({ status: false, message: "No data provided in the request body." })
        const { fname, lname, email, phone, password, address } = data;

        let arr = { fname, lname, email, phone, password, address };
        let keys = [...validation(arr)]
        if (keys.length > 0) return res.status(400).send({ status: false, message: `Enter the following mandatory field(s): [${keys}]` });

        if (!nameRegex.test(fname)) return res.status(400).send({ status: false, message: "fname should contain alphabets only." });
        if (!nameRegex.test(lname)) return res.status(400).send({ status: false, message: "lname should contain alphabets only." });
        if (!emailRegex.test(email)) return res.status(400).send({ status: false, message: "Enter email in a valid format." });
        if (!phoneRegex.test(phone)) return res.status(400).send({ status: false, message: "Enter the phone number in a valid Indian format." });
        if (!passRegex.test(password)) return res.status(400).send({ status: false, message: "Password should be 8-15 characters long alphanumeric with at least one uppercase, one lowercase and one special character." });

        const emailFound = await userModel.findOne({ email });
        if (emailFound) return res.status(400).send({ status: false, message: "email is not unique." });
        const phoneFound = await userModel.findOne({ phone });
        if (phoneFound) return res.status(400).send({ status: false, message: "phone number is not unique." });

        if (typeof address === 'string') {
            data.address = parsingFunc(address); 
            if(data.address.status===false) return res.status(400).send(data.address);
        }

        if (!isValidBody(data.address) || typeof data.address !== 'object') return res.status(400).send({ status: false, message: "No data provided in address." });

        if (typeof data.address.shipping === 'string') data.address.shipping = parsingFunc(data.address.shipping);
        if (typeof data.address.billing === 'string') data.address.billing = parsingFunc(data.address.billing);
        let { shipping, billing } = data.address;
        let addressArr = { shipping, billing };
        keys = [...validation(addressArr)]
        if (keys.length > 0) return res.status(400).send({ status: false, message: `Enter the following mandatory fields: [${keys}]` });

        {
            let { street, city, pincode } = shipping;
            let shippingArr = { street, city, pincode };
            keys = [...validation(shippingArr)];
            if (keys.length > 0) return res.status(400).send({ status: false, message: `Enter the following mandatory fields: [${keys}] in shipping address.` });
            if (!nameRegex.test(city)) return res.status(400).send({ status: false, message: "city name should contain alphabets only." });
            if (!pinRegex.test(pincode)) return res.status(400).send({ status: false, message: "pincode should be numeric." });
        }

        {
            let { street, city, pincode } = billing;
            let billingArr = { street, city, pincode };
            keys = [...validation(billingArr)];
            if (keys.length > 0) return res.status(400).send({ status: false, message: `Enter the following mandatory fields: [${keys}] in billing address.` });
            if (!nameRegex.test(city)) return res.status(400).send({ status: false, message: "city name should contain alphabets only." });
            if (!pinRegex.test(pincode)) return res.status(400).send({ status: false, message: "pincode should be numeric." });
        }

        let files = req.files
        if (!files || files.length === 0) return res.status(400).send({ status: false, message: "No profileImage found." })

        data.profileImage = await uploadFile(files[0])

        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(password, salt);
        data.password = hashedPass;

        const userCreated = await userModel.create(data);
        return res.status(201).send({ status: true, message: 'User created successfully', data: userCreated });
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}



const loginUser = async function (req, res) {
    try {
        let email = req.body.email
        let password = req.body.password
        if (!email || !password) return res.status(400).send({ status: false, message: "Provide the email and password to login." })  // if either email, password or both not present in the request body.

        if (!emailRegex.test(email))  // --> email should be provided in right format
            return res.status(400).send({ status: false, message: "Please enter a valid emailId." })

        let user = await userModel.findOne({ email })  // to find that particular user document.
        if (!user) return res.status(401).send({ status: false, message: "Email or password is incorrect." })  // if the user document isn't found in the database.

        let value = await bcrypt.compare(password.toString(), user.password);
        if (!value) return res.status(401).send({ status: false, message: "Email or password is incorrect." })

        let token = jwt.sign(  // --> to generate the jwt token
            {
                userId: user._id.toString(),                            // --> payload
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2),     // --> expiry set for 2 hours
                iat: Math.floor(Date.now() / 1000)
            },
            "avinash-shubhro-dhiraj-santosh"                            // --> secret key
        )

        res.setHeader("x-api-key", token)  // to send the token in the header of the browser used by the user.
        return res.status(200).send({ status: true, message: 'User login successful', data: { userId: user._id, token: token } })  // token is shown in the response body.
    } catch (err) {
        return res.status(500).send({ status: false, err: err.message })
    }
}



const getProfile = async function (req, res) {
    try {
        let user = await userModel.findById(req.userId);
        return res.status(200).send({ status: true, message: "User profile details", data: user });
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}



const updateProfile = async function (req, res) {
    try {
        let data = req.body;
        data = { ...parsingFunc(data) };

        if (!isValidBody(data)) return res.status(400).send({ status: false, message: "No data found to update." })
        let { fname, lname, email, phone, password, address } = data;

        const validUkeys = function (value,valueName) {
            let regex = { fname: nameRegex, lname: nameRegex, email: emailRegex, phone: phoneRegex, password: passRegex, city: nameRegex, pincode: pinRegex };
            let msgs = {
                fname: "fname should contain alphabets only.",
                lname: "lname should contain alphabets only.",
                email: "email is not valid.",
                phone: "Enter the phone number in a valid Indian format.",
                password: "Password should be 8-15 characters long alphanumeric with at least one uppercase, one lowercase and one special character.",
                address: "Provide address.",
                shipping: "Provide shipping address.",
                billing: "Provide billing address.",
                street: "Provide street",
                city: "city name should contain alphabets only.",
                pincode: "pincode should be numeric."
            }
            const arr = Object.keys(value);
            if(arr.length==0)return { status: false, message: `provide data in ${valueName} to update` }
            for (let i of arr) {
                if (msgs[i]) {
                    if (!isValid(value[i])) return { status: false, message: `Provide ${i}` }
                    if (regex[i] && !regex[i].test(value[i].trim())) return { status: false, message: msgs[i] }
                }
            }
        }

        let resValidUkeys = validUkeys(data);
        if (resValidUkeys) return res.status(400).send(resValidUkeys);

        if (address) {
            address = parsingFunc(address);
            if(address.status===false) return res.status(400).send(address);

            if (typeof address !== 'object') return res.status(400).send({ status: false, message: "invalid address." })
            resValidUkeys = validUkeys(address,"address");
            if (resValidUkeys) return res.status(400).send(resValidUkeys);

            if (address['shipping']) {
                if (typeof address['shipping'] !== 'object') return res.status(400).send({ status: false, message: "invalid shipping address." })
                resValidUkeys = validUkeys(address['shipping']);
                if (resValidUkeys) return res.status(400).send(resValidUkeys);
            }
            if (address.billing) {
                if (typeof address.billing !== 'object') return res.status(400).send({ status: false, message: "invalid billing address." })
                resValidUkeys = validUkeys(address.billing);
                if (resValidUkeys) return res.status(400).send(resValidUkeys);
            }
        }

        let files = req.files
        if (files && files.length > 0) data.profileImage = await uploadFile(files[0])

        if (password) {
            if (!passRegex.test(password)) return res.status(400).send({ status: false, message: "Password should be 8-15 characters long alphanumeric with at least one uppercase, one lowercase and one special character." });
            const salt = await bcrypt.genSalt(10);
            const hashedPass = await bcrypt.hash(password, salt);
            data.password = hashedPass;
        }

        let userUpdated = await userModel.findByIdAndUpdate(
            req.userId, 
            { fname, lname, email, phone, password, address, profileImage: data.profileImage },
            { new: true });
        return res.status(200).send({ status: true, message: 'User profile updated', data: userUpdated })
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}



module.exports = { uploadFile, createUser, loginUser, getProfile, updateProfile }