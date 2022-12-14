const { default: mongoose } = require("mongoose");
const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const { isValid } = require("../validations/validator");



const createOrder = async function (req, res) {
    try {
        const userId = req.params.userId;
        const data = req.body;
        const { cartId, cancellable } = data;
        const cart = await cartModel.findOne({ userId }).select({ createdAt: 0, updatedAt: 0, __v: 0 }).lean();

        if (!cart) return res.status(404).send({ status: false, message: "This user's cart has not been created yet." });
        if (cartId) {
            if (!mongoose.isValidObjectId(cartId)) return res.status(400).send({ status: false, message: "Enter a valid cartId." });
            if (cartId != cart._id) return res.status(400).send({ status: false, message: "This user doesn't own this cart." });
        }
        if (!cart.items.length) return res.status(400).send({ status: false, message: "The cart is empty.🛒" });

        delete cart._id;
        let totalQuantity = 0;
        cart.items.forEach(x => totalQuantity += x.quantity);
        const order = { ...cart, totalQuantity };

        if (Object.keys(data).includes('cancellable')) {
            if (typeof cancellable == 'string') {
                if (cancellable != 'true' && cancellable != 'false') return res.status(400).send({ status: false, message: "Provide either 'true' or 'false' in cancellable." });
                order.cancellable = cancellable == 'true' ? true : false;
            }
            else if (typeof cancellable == 'boolean') {
                order.cancellable = cancellable == true ? true : false;
            } else return res.status(400).send({ status: false, message: "Provide either 'true' or 'false' in cancellable." });
        }

        let orderCreated = await orderModel.create(order);
        await cartModel.findOneAndUpdate({ userId }, { items: [], totalPrice: 0, totalItems: 0 });
        orderCreated = await orderModel.findOne(order).populate('items.productId', 'title price productImage isFreeShipping');
        return res.status(201).send({ status: true, message: "Success", data: orderCreated });
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}



const updateOrder = async function (req, res) {
    try {
        const userId = req.params.userId;
        const { orderId, status } = req.body;

        if (!isValid(orderId)) return res.status(400).send({ status: false, message: "Provide orderId in the request body." });
        if (!mongoose.isValidObjectId(orderId)) return res.status(400).send({ status: false, message: "Enter a valid orderId." });
        if (!isValid(status)) return res.status(400).send({ status: false, message: "Provide the status to update." });
        const enumerated = ['completed', 'cancelled'];
        if (!enumerated.includes(status)) return res.status(400).send({ status: false, message: "Provide either 'completed' or 'cancelled'" });

        let order = await orderModel.findOne({ _id: orderId, isDeleted: false });
        if (!order) return res.status(404).send({ status: false, message: "Order doesn't exist." });
        
        if (`${order.userId}` != userId) return res.status(400).send({ status: false, message: "orderId doesn't match with that of the user." });

        if (order.status == 'completed' || order.status == 'cancelled') {
            return res.status(400).send({ status: false, message: 'Order already ' + (order.status == 'completed' ? 'completed' : 'cancelled') });
        }

        if (status == 'completed') {
            const updatedOrder = await orderModel.findByIdAndUpdate( orderId, { status }, { new: true } )
            .populate('items.productId', 'title price productImage isFreeShipping');
            return res.status(200).send({ status: true, message: 'Success', data: updatedOrder });
        } else {
            if (order.cancellable == false) return res.status(400).send({ status: false, message: "Order is not cancellable." });
            const updatedOrder = await orderModel.findByIdAndUpdate( orderId, { status }, { new: true } )
            .populate('items.productId', 'title price productImage isFreeShipping');
            return res.status(200).send({ status: true, message: 'Success', data: updatedOrder });
        }
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
    }
}



module.exports = { createOrder, updateOrder };