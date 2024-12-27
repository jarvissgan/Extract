// import { initializeApp } from "firebase/app";
import axios from "axios";
import express, { response } from "express";
import { Router } from "express";
import { db } from "../db-connections.js";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

import Sqids from "sqids";
import userNotFound from "../errors.js"; //error messages

const router = Router();
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
  res.send("Hello World! Test transaction_UUID: " + transaction_uuidv4());
});

// gets transaction based on user id via sqid
router.get("/transaction/:sqid", (req, res) => {
  const query = "SELECT * FROM transaction WHERE user_id = ?";
  const sqid = req.params.sqid;
  const user_id = decodeSqid(sqid);

  if (!user_id || user_id == undefined) {
    return res.status(400).json({
      error: `${sqid} is invalid or doesn't contain anything. Please check and try again.`,
    });
  }
  db.query(query, user_id, (err, results) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      console.log(`Transactions not found. user_id: '${user_id}' `);
      return res.status(404).json({
        message: `Transactions with user_sqid '${sqid}' not found. Check and try again.`,
      });
    }
    console.log(
      `retireved transactions from user sqid ${sqid}.\n${JSON.stringify(
        results,
        null,
        2
      )}`
    );
    return res.status(200).json(results);
  });
});

//creates transaction and assigns it a transaction_UUID
router.post("/transaction", (req, res) => {
  const transaction_uuid = uuidv4();
  const created_timestamp = new Date();

  const { sqid, transaction_name, transaction_amount, transaction_details } =
    req.body;
  const user_id = decodeSqid(sqid);

  console.log("user_id: ", user_id);

  // Validate input values
  const valueDictionary = {
    user_id: user_id,
    transaction_name: transaction_name,
    transaction_amount: transaction_amount,
    transaction_details: transaction_details,
  };

  for (const [key, value] of Object.entries(valueDictionary)) {
    if (
      !value ||
      (typeof value === "object" && Object.keys(value).length === 0)
    ) {
      return res.status(400).json({
        error: `${key} doesn't contain anything. Please check and try again.`,
      });
    }
  }

  // Prepare SQL query and values
  const query =
    "INSERT INTO transaction (transaction_uuid, user_id, transaction_name, transaction_amount, transaction_details, created_timestamp) VALUES (?,?,?,?,?,?)";
  const values = [
    transaction_uuid,
    user_id,
    transaction_name,
    transaction_amount,
    JSON.stringify(transaction_details),
    created_timestamp,
  ];

  // Execute query
  db.query(query, values, (err, results) => {
    if (err) {
      console.error(`Error ${err.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: `Unable to create transaction ${transaction_uuid} due to an unexpected error. Check details and try again.`,
      });
    }

    console.log(
      `Created transaction\ntransaction_uuid: '${transaction_uuid}'\nuser_sqid: '${sqid}'\ncreated_time: '${created_timestamp}'`
    );
    return res.status(200).json({
      transaction_uuid: transaction_uuid,
      user_sqid: sqid,
      created_timestamp: created_timestamp,
    });
  });
});

// gets user based on id via sqid
router.get("/user/:sqid", (req, res) => {
  const query = "SELECT * FROM users WHERE user_id = ?";
  const sqid = req.params.sqid;
  const userId = decodeSqid(sqid);

  db.query(query, userId, (err, results) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: `User with sqid ${sqid} not found` });
    }
    console.log(
      `retireved user with sqid ${sqid}.\n${JSON.stringify(
        results[0],
        null,
        2
      )}`
    );
    return res.status(200).json(results[0]);
  });
});

// creates user based on json received
router.post("/user", (req, res) => {
  const created_timestamp = new Date();
  const updated_timestamp = new Date();
  const { username, user_details, preference_json, account_status } = req.body;

  const valueDictionary = {
    username,
    user_details,
    preference_json,
    account_status,
  };

  // Validate inputs
  for (const key in valueDictionary) {
    const value = valueDictionary[key];
    if (!value || Object.keys(value).length === 0) {
      return res.status(400).json({
        error: `${key} doesn't contain anything. Please check and try again.`,
      });
    }
  }

  // Insert user into database
  const insertQuery = `
    INSERT INTO users (username, user_details, preference_json, account_status, created_timestamp) 
    VALUES (?, ?, ?, ?, ?)`;
  const insertValues = [
    username,
    JSON.stringify(user_details),
    JSON.stringify(preference_json),
    JSON.stringify(account_status),
    created_timestamp,
  ];

  db.query(insertQuery, insertValues, (insertErr, insertResults) => {
    if (insertErr) {
      console.error(`Error connecting to the database. ${insertErr.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    const user_id = insertResults.insertId;
    const sqid = encodeSqid([user_id]);

    // Update user_sqid
    const updateQuery = `
      UPDATE users SET user_sqid = ?, updated_timestamp = ? WHERE user_id = ?`;
    const updateValues = [sqid, updated_timestamp, user_id];

    db.query(updateQuery, updateValues, (updateErr, updateResults) => {
      if (updateErr) {
        console.error(`Error updating the database. ${updateErr.message}`);
        return res.status(500).json({ error: "Database update error" });
      }

      if (updateResults.affectedRows === 0) {
        return res.status(404).json({
          error: `Unable to update user_sqid for user_id ${user_id}.`,
        });
      }

      console.log(`Created user\nusername: '${username}'\nsqid: '${sqid}'`);
      return res.status(200).json({
        username,
        sqid,
        created_timestamp,
      });
    });
  });
});

export default router;
