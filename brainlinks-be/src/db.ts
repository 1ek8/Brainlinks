import mongoose, {model, Schema} from "mongoose"


const userSchema = new Schema({
    username: {type: String,
            unique:true
        },
    password: String
})

export const UserModel = model("User", userSchema)

const contentSchema = new Schema ({
    title: { type: String, required: true},
    link: { type: String, required: false},
    textContent: { type:String, required: false},
    type: String,
    tags: [{ type: mongoose.Types.ObjectId, ref: 'Tag' }],
    userId: {type: mongoose.Types.ObjectId, ref: 'User', required: true}
})

export const ContentModel = model("Content", contentSchema)

const tagSchema = new Schema ({
    name: { type: String, required: true},
    userId: {type: mongoose.Types.ObjectId, ref: 'User', required: true}
})

tagSchema.index({ name: 1, userId: 1 }, { unique: true })

export const TagModel = model("Tag", tagSchema)

const linkSchema = new Schema ({
    hash: String,
    userId: {type: mongoose.Types.ObjectId, required: true, unique: true, ref: 'User'}
})

export const LinkModel = model("Link", linkSchema)