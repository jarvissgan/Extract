// import { initializeApp } from "firebase/app";
import { Router } from "express";
import { db } from "../db-connections.js";

import Sqids from "sqids";

const userRouter = Router();
const sqids = new Sqids({ minLength: 8 });


function encodeSqid(user_id) {
  const encodedId = sqids.encode(user_id);
  return encodedId;
}

//checks if user exists via email in params
userRouter.get("/user", (req, res) => {
  let query = "";

  let params = [];
  const { email } = req.query;

  if (email == undefined || !email) {
    return res.status(400).json({
      error: `query is invalid or doesn't contain anything. Please check and try again.`,
    });
  }

  // filters by date if both dates exist
  if (email) {
    query = "SELECT * FROM users WHERE email = ?";
    console.log(`/user: using email ${email}`);
    params.push(email);
  } 

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res
        .status(202)
        .json({ message: `User not found` });
    }
    console.log(
      `retireved user with sqid ${results}.\n${JSON.stringify(
        results[0],
        null,
        2
      )}`
    );
    return res.status(200).json(results[0]);
  });
});

// gets user based on id via sqid
userRouter.get("/user/:sqid", (req, res) => {
  const query = "SELECT * FROM users WHERE user_sqid = ?";
  const user_sqid = req.params.sqid;

  db.query(query, user_sqid, (err, results) => {
    if (err) {
      console.error("Error retrieving user:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: `User with sqid ${user_sqid} not found` });
    }
    console.log(
      `retireved user with sqid ${user_sqid}.\n${JSON.stringify(
        results[0],
        null,
        2
      )}`
    );
    return res.status(200).json(results[0]);
  });
});

// creates user based on json received
userRouter.post("/user", (req, res) => {
  const created_timestamp = new Date();
  const updated_timestamp = new Date();
  const { username, user_details, email, preference_json, account_status } = req.body;

  const valueDictionary = {
    username,
    user_details,
    email,
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
  const insertQuery = "INSERT INTO users (username, user_details, preference_json, email, account_status, created_timestamp) VALUES (?, ?, ?, ?, ?, ?) ";
  const insertValues = [
    username,
    JSON.stringify(user_details),
    JSON.stringify(preference_json),
    email,
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

// modifies user based on json received
userRouter.put("/user/:sqid", (req, res) => {
  const updated_timestamp = new Date();
  const { username, user_details, preference_json, email, account_status } = req.body;
  const user_sqid = req.params.sqid;

  const valueDictionary = {
    username,
    user_details,
    preference_json,
    email,
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

  const query = `
    UPDATE users SET username = ?, user_details = ?, preference_json = ?, email, account_status = ?, updated_timestamp = ? WHERE user_sqid = ?`;
  const values = [
    username,
    JSON.stringify(user_details),
    JSON.stringify(preference_json),
    JSON.stringify(account_status),
    updated_timestamp,
    user_sqid,
  ];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error(`Error connecting to the database. ${err.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: `Unable to update user sqid ${user_sqid} due to an unexpected error. Check details and try again.`,
      });
    }
    console.log(`Updated user\n
      user_sqid: '${user_sqid}', 
      username: '${username}',
      user_details: '${JSON.stringify(user_details, null)}',
      preference_json: '${JSON.stringify(preference_json, null)}',
      account_status: '${JSON.stringify(account_status, null)}',
      updated_timestamp: '${updated_timestamp}'`);

    return res.status(200).json({
      user_sqid: user_sqid,
      username: username,
      user_details: user_details,
      preference_json: preference_json,
      account_status: account_status,
      updated_timestamp: updated_timestamp,
    });
  });
});

userRouter.delete("/user/:sqid", (req, res) => {
  const user_sqid = req.params.sqid;
  const deleted_timestamp = new Date();
  const query = "DELETE from users WHERE user_sqid = ?";

  db.query(query, user_sqid, (err, results) => {
    if (err) {
      console.error(`Error connecting to the database. ${err.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: `Unable to delete user sqid ${user_sqid} due to an unexpected error, or user might not exist. Check details and try again.`,
      });
    }
    console.log(`Deleted user\n
      user_sqid: '${user_sqid}', 
      deleted_timestamp: '${deleted_timestamp}'
      `);

    return res.status(200).json({
      user_sqid: user_sqid,
      deleted_timestamp: deleted_timestamp,
    });
  });
});

export default userRouter;
