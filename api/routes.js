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
  console.log("checking if", userUUID + " is a valid uuid");

  //check if valid uuid
  if (!uuidValidate(userUUID)) {
    return console.error(userUUID + " is an valid uuid");
  } else {
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
  }
});

// creates user based on json received
router.post("/user", (req, res) => {
  const { username, user_details, preference_json, account_status } = req.body;

  console.log(`checking if req.body contain json`);

  //check if req.body is empty
  if (Object.keys(req.body).length === 0) {
    console.error("req.body is empty");
    return res.status(400).json({ error: "Request body is empty" });
  }

  // generates user uuid
  const uuid = uuidv4();
  const created_timestamp = new Date();

  // set POST statement
  const query =
    "INSERT INTO users (user_uuid, username, user_details, preference_json, account_status, created_timestamp)  VALUES (?,?,?,?,?,?)";
  const values = [
    uuid,
    username,
    JSON.stringify(user_details),
    JSON.stringify(preference_json),
    JSON.stringify(account_status),
    created_timestamp,
  ];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error(`Error connecting to the database. ${err.message}`);
      res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      res.status(404).json({
        message: `Unable to create user ${username} due to an unexpected error. Check details and try again.`,
      });
    }

    console.log(`Created user "${username} with uuid ${uuid}`);
    res.status(200).json({
      username: username,
      uuid: uuid,
      created_timestamp: created_timestamp,
    });
  });
});

export default router;
