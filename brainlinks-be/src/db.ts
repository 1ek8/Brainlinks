import mongoose, {model, Mongoose, Schema} from "mongoose"


const userSchema = new Schema({
    username: {type: String,
            unique:true
        },
    password: String
})

export const UserModel = model("User", userSchema)

const contentSchema = new Schema ({
    title: { type: String, required: true},
    link: { type: String, required: true},
    type: String,
    tags: [{type: mongoose.Types.ObjectId, ref: 'Tag'}],
    userId: {type: mongoose.Types.ObjectId, ref: 'User', required: true},
    share: { type: Boolean, required: false}
})

export const ContentModel = model("Content", contentSchema)

const linkSchema = new Schema ({
    hash: String,
    userId: {type: mongoose.Types.ObjectId, required: true, unique: true, ref: 'User'}
})

export const LinkModel = model("Link", linkSchema)