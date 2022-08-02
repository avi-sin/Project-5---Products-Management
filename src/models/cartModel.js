const mongoose = require('mongoose');
const objectId = mongoose.Schema.Types.ObjectId;

const cartSchema = new mongoose.Schema({

    userId: { type: objectId, ref: 'User', required :true, unique: true },
    items: [{
        _id: false,
        productId: { type: objectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true }
    }],
    totalPrice: { type: Number, required: true },
    totalItems: { type: Number, required: true }

}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);