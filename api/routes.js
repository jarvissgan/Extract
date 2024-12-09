// import { initializeApp } from "firebase/app";
import axios from "axios";
import express, { response } from "express";
const routes = express.Router();

import { v4 as uuidv4 } from 'uuid';

routes.get("/test", (req, res) => {
  res.send("Hello World! Test UUID: " + uuidv4() );
});


export default routes;