"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "fallback_secret");
            req.user = await User_1.User.findById(decoded.id).select("-password");
            if (!req.user) {
                res.status(401).json({ message: "Not authorized, user not found" });
                return;
            }
            next();
        }
        catch (error) {
            console.error(error);
            res.status(401).json({ message: "Not authorized, token failed" });
            return;
        }
    }
    else {
        res.status(401).json({ message: "Not authorized, no token" });
        return;
    }
};
exports.protect = protect;
