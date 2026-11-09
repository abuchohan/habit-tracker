import { NextFunction, type Request, type Response } from 'express'
import prisma from '../prisma/client'

export async function verifySession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const sessionId = req.cookies.session_id

        if (!sessionId) {
            return res.status(401).json({ message: 'No session found' })
        }

        const currentSession = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        })

        if (!currentSession || currentSession.expiresAt <= new Date()) {
            return res
                .status(401)
                .json({ message: 'You do not have an active session' })
        }

        req.user = currentSession.user
        req.session = currentSession

        next()
    } catch (err) {
        console.error('verifySession error:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
}
