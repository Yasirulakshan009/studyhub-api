import dotenv from "dotenv"
dotenv.config()

import dns from "node:dns"
if (process.env.USE_CUSTOM_DNS === "true") {
  dns.setServers(["8.8.8.8", "1.1.1.1"])
}

import express, { type NextFunction, type Request, type Response } from "express"
import mongoose from "mongoose"
import cors from "cors"
import AuthRouter from "./routes/auth.routers"
import AdminRouter from "./routes/admin.routes"
import categoryRouter from "./routes/category.routes"
import NoteRouter from "./routes/note.routes"


const MONGO_URL = process.env.MONGO_URL || ""
const PORT = process.env.PORT || 5000

const app = express()

app.use(cors())
app.use(express.json())

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({ message: "StudyHub API is running..!" })
})

app.use("/api/v1/auth", AuthRouter)
app.use("/api/v1/admin", AdminRouter)
app.use("/api/v1/categories", categoryRouter)
app.use("/api/v1/notes", NoteRouter) 

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Invalid JSON body" })
  }
  console.error(err)
  res.status(500).json({ message: "Internal server error" })
})

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