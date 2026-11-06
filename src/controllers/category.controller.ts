import { Request, Response } from "express"
import mongoose from "mongoose"
import { CategoryModel } from "../models/category.model"

export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name, description, parentId } = req.body

        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
            return res.status(400).json({ message: "Name must be 2-50 characters" })
        }

        if (description !== undefined && (typeof description !== "string" || description.length > 300)) {
            return res.status(400).json({ message: "Description must be at most 300 characters" })
        }

        let parent = null
        if (parentId !== undefined && parentId !== null) {
            if (!mongoose.isValidObjectId(parentId)) {
                return res.status(400).json({ message: "Invalid parent category id" })
            }

            parent = await CategoryModel.findById(parentId)
            if (!parent) {
                return res.status(404).json({ message: "Parent category not found" })
            }
            if (parent.parentId) {
                return res.status(400).json({ message: "A sub-category cannot have its own sub-categories" })
            }
        }

        const exists = await CategoryModel.findOne({ name: name.trim(), parentId: parent ? parent._id : null })
        if (exists) {
            return res.status(409).json({ message: "Category already exists" })
        }

        const category = await CategoryModel.create({
            name: name.trim(),
            description,
            parentId: parent ? parent._id : null
        })

        res.status(201).json({ message: "Category created successfully", data: category })
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Category already exists" })
        }
        console.error(error)
        res.status(500).json({ message: "Failed to create category" })
    }
}

export const getCategories = async (req: Request, res: Response) => {
    try {
        const { parentId } = req.query

        let filter: { isActive: boolean; parentId: any } = { isActive: true, parentId: null }

        if (parentId !== undefined) {
            if (typeof parentId !== "string" || !mongoose.isValidObjectId(parentId)) {
                return res.status(400).json({ message: "Invalid parent category id" })
            }
            filter.parentId = parentId
        }

        const categories = await CategoryModel.find(filter).sort({ name: 1 })

        res.status(200).json({ message: "Categories loaded successfully", data: categories })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load categories" })
    }
}

export const getCategoryById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid category id" })
        }

        const category = await CategoryModel.findById(id)
        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        res.status(200).json({ message: "Category loaded successfully", data: category })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to load category" })
    }
}

export const updateCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const { name, description, isActive } = req.body

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid category id" })
        }

        if (name === undefined && description === undefined && isActive === undefined) {
            return res.status(400).json({ message: "Nothing to update" })
        }

        const category = await CategoryModel.findById(id)
        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        if (category.isSystem && (name !== undefined || isActive !== undefined)) {
            return res.status(403).json({ message: "System category cannot be renamed or deactivated" })
        }

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 50) {
                return res.status(400).json({ message: "Name must be 2-50 characters" })
            }

            const clash = await CategoryModel.findOne({
                _id: { $ne: category._id },
                name: name.trim(),
                parentId: category.parentId
            })
            if (clash) {
                return res.status(409).json({ message: "Category already exists" })
            }

            category.name = name.trim()
        }

        if (description !== undefined) {
            if (typeof description !== "string" || description.length > 300) {
                return res.status(400).json({ message: "Description must be at most 300 characters" })
            }
            category.description = description
        }

        if (isActive !== undefined) {
            if (typeof isActive !== "boolean") {
                return res.status(400).json({ message: "isActive must be true or false" })
            }
            category.isActive = isActive
        }

        await category.save()

        res.status(200).json({ message: "Category updated successfully", data: category })
    } catch (error: any) {
        if (error?.code === 11000) {
            return res.status(409).json({ message: "Category already exists" })
        }
        console.error(error)
        res.status(500).json({ message: "Failed to update category" })
    }
}

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid category id" })
        }

        const category = await CategoryModel.findById(id)
        if (!category) {
            return res.status(404).json({ message: "Category not found" })
        }

        if (category.isSystem) {
            return res.status(403).json({ message: "System category cannot be deleted" })
        }

        const subCount = await CategoryModel.countDocuments({ parentId: category._id })
        if (subCount > 0) {
            return res.status(409).json({ message: "Delete the sub-categories first" })
        }

        await category.deleteOne()

        res.status(200).json({ message: "Category deleted successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Failed to delete category" })
    }
}