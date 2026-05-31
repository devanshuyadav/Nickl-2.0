import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            // THE WHITELIST: Only allow YOUR email address to log in.
            // Replace with your actual Gmail address.
            const allowedEmail = "devanshuyadavwork@gmail.com";
            // const allowedEmail = process.env.ADMINEMAIL;

            if (user.email === allowedEmail) {
                return true;
            } else {
                // If anyone else tries to log in, reject them
                console.warn(`Unauthorized login attempt by: ${user.email}`);
                return false;
            }
        },
    },
    pages: {
        signIn: '/login', // We will create a clean login page next
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };