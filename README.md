### Overview
`insight-flow` is a web application that allows Youtube Channel owners the ability for their audience to 
ask questions against their content. This allows users to gain insights into the content creators opinions 
across all of their videos. The app will also help content creators get insights into:
- the questions users ask about their content
- what questions their content doesn't answer adequately

The app also provides links to the videos being cited in the response along with timestamps in the url to
place a user right in the relevant part of a video. This is meant to create a feedback loop of the user
engaging a content creators chat page, giving the content creator analytics to help know what content to make,
and also giving the content creator more views when users click through the sources.

### Technologies Used
- Prisma for postgresql db management and ORM logic
- ShadCN components to build UI
- tailwind for styling
- next.js for web app framework
- Clerk for authentication

### Postgresql Notes
1. The postgresql db must have `pgvector` enabled. For example the db environment has to have ran
`CREATE EXTENSION IF NOT EXISTS vector;`

### Configure `.env` file 
Create `.env` file in root of project with these values:
```
# URL to postgresql db
DATABASE_URL=""
GOOGLE_API_KEY=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"
```

### Dev setup
1. `npm i`
2. `npm run dev`
3. open `localhost:3000`

