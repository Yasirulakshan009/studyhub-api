
import { NextFunction, Request, Response } from "express"
import { verifyAccessToken, AuthPayload } from "../util/jwt"

export interface AuthRequest extends Request {
    user?: AuthPayload
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const header = req.headers.authorization

    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or malformed token" })
    }

    try {
        req.user = verifyAccessToken(header.split(" ")[1])
        next()
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}

export const optionalAuthenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const header = req.headers.authorization

    if (!header?.startsWith("Bearer ")) {
        return next()
    }

    try {
        req.user = verifyAccessToken(header.split(" ")[1])
    } catch {
    }

    next()
}
