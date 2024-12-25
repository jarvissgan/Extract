// import { initializeApp } from "firebase/app";
import axios from "axios";
import express, { response } from "express";
import { Router } from "express";
import { db } from "../db-connections.js";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import Sqids from "sqids";

const router = Router();
// const SQID = require('sqids').default;
const sqids = new Sqids({ minLength: 8 });

function decodeSqid(sqidString) {
  const decodedId = sqids.decode(sqidString);
  return decodedId;
}

function encodeSqid(user_id) {
  const encodedId = sqids.encode(user_id);
  return encodedId;
}

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

    db.query(query, userUUID, (err, results) => {
      if (err) {
        console.error("Error retrieving user:", err.message);
        res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
        res
          .status(404)
          .json({ message: `User with uuid ${userUUID} not found` });
      }
      console.log(
        `retireved user with uuid ${userUUID}.\n${JSON.stringify(
          results[0],
          null,
          2
        )}`
      );
      res.status(200).json(results[0]);
    });
  }
});

// creates user based on json received
router.post("/user", (req, res) => {
  const created_timestamp = new Date();

  const { username, user_details, preference_json, account_status } = req.body;
  var valueDictonary = {
    username: username,
    user_details: user_details,
    preference_json: preference_json,
    account_status: account_status,
  };
  // generates user uuid
  for (var key in valueDictonary) {
    var value = valueDictonary[key];

    if (!value || Object.keys(value).length === 0) {
      res.status(400).json({
        error: `${key} doesn't contain anything. Please check and try again.`,
      });
    }
  }
  // set POST statement
  const query =
    "INSERT INTO users (username, user_details, preference_json, account_status, created_timestamp)  VALUES (?,?,?,?,?) RETURNING user_id";
  const values = [
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

    const sqid = encodeSqid([results[0].user_id]);

    console.log(`Created user\nusername: '${username}'\nsqid: '${sqid}'`);
    res.status(200).json({
      username: username,
      sqid: sqid,
      created_timestamp: created_timestamp,
    });
  });
});

export default router;
