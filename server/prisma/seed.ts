import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import bcrypt from 'bcrypt'

async function main() {
    await prisma.user.upsert({
        where: { email: 'abuchohan@hotmail.co.uk' },
        update: {},
        create: {
            email: 'abuchohan@hotmail.co.uk',
            password: await bcrypt.hash('password123', 10),
            name: 'Abu Chohan',
            avatar: null,
        },
    })
}

main()
    .then(async () => {
        console.log('Users have been seeded')
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
