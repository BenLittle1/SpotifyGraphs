import NextAuth from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import { NextAuthOptions } from "next-auth";

const scopes = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
].join(" ");

const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes,
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }

      // Return token if it's still valid
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }

      // Token has expired, try to refresh it
      try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
          throw refreshedTokens;
        }

        return {
          ...token,
          accessToken: refreshedTokens.access_token,
          expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
          refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        console.error("Error refreshing access token", error);
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/error",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 