import { Session, User } from '@prisma/client'

type SafeUser = Omit<User, 'password' | 'createdAt'>

declare global {
    namespace Express {
        interface Request {
            user?: SafeUser
            session?: Session
        }
    }
}
