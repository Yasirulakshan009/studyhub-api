import dns from "node:dns"
dns.setServers(["8.8.8.8", "1.1.1.1"])

import express, { type Request, type Response } from "express"
import mongoose from "mongoose"
import cors from "cors"
import AuthRouter from "./routes/auth.routers"
import dotenv from "dotenv"
dotenv.config()

const MONGO_URL = process.env.MONGO_URL || ""
const PORT = process.env.PORT || 5000

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({ message: "StudyHub API is running..!" })
})

app.use("/api/v1/auth", AuthRouter)

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("DB connected..!")

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Fail to connect DB..!", err)
    process.exit(1)
  })