const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');


const verifyFunc = token => {
    return jwt.verify(token, 'avinash-shubhro-dhiraj-santosh', (err, decode) => {
        if (err) {
            return null
        } else {
            return decode
        }
    })
}



const auth = async function (req, res, next) {
    try {
        let token = req.headers.authorization
        if (!token) return res.status(401).send({ status: false, message: "Authentication failed: token must be present in request header."});
        token = token.split(' ')[1];

        let decodedToken = verifyFunc(token);
        if (!decodedToken) return res.status(403).send({ status: false, message: "invalid token" });

        let userId = req.params.userId
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).send({ status: false, message: "Provide a valid userId." })

        if (userId !== decodedToken.userId) return res.status(403).send({ status: false, message: "Authorization failed: userId in params doesn't match with that in token."});
        next();
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}



module.exports = { auth }