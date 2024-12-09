// import { initializeApp } from "firebase/app";
import axios from "axios";
import express, { response } from "express";
import { Router } from "express";
import { db } from "../db-connections.js";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

const router = Router();

//TODO create authentication method for backend
router.get("/test", (req, res) => {
  res.send("Hello World! Test UUID: " + uuidv4());
});

// gets user based on UUID
router.get("/user/:uuid", (req, res) => {
  const query = "SELECT * FROM users WHERE user_uuid = ?";

  const userUUID = req.params.uuid;
  console.log('checking if', userUUID + " is a valid uuid");
  
  //check if valid uuid
  if (!uuidValidate(userUUID)) {
    return console.error(userUUID + " is an valid uuid");
  }

  console.log(userUUID + " is a valid uuid");

  db.query(query, [userUUID], (err, results) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      res.status(500).json({ error: "Database error" });
    } else if (results.length === 0) {
      res.status(404).json({ message: "User not found" });
    } else {
      res.status(200).json(results[0]);
    }
  });
});

export default router;
