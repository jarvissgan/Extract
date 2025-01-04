// import { initializeApp } from "firebase/app";
import axios from "axios";
import express, { response } from "express";
import { Router } from "express";
import { db } from "../db-connections.js";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

import Sqids from "sqids";
import userNotFound from "../errors.js"; //error messages

const transactionRouter = Router();
const sqids = new Sqids({ minLength: 8 });

function decodeSqid(sqidString) {
  const decodedId = sqids.decode(sqidString);
  return decodedId;
}

function encodeSqid(user_id) {
  const encodedId = sqids.encode(user_id);
  return encodedId;
}

// gets transaction based on user id via sqid
transactionRouter.get("/transaction/user/:sqid", (req, res) => {
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

//gets transaction via UUID
transactionRouter.get("/transaction/:uuid", (req, res) => {
  const query = "SELECT * FROM transaction WHERE transaction_uuid = ?";
  const transaction_uuid = req.params.uuid;
  console.log('transaction_uuid: ', transaction_uuid);

  db.query(query, transaction_uuid, (err, results) => {
    if (err) {
      console.error("Error retrieving transaction:", err.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      console.log(
        `Transaction not found. transaction_uuid: '${transaction_uuid}' `
      );
      return res.status(404).json({
        message: `Transactions with transaction_uuid '${transaction_uuid}' not found. Check and try again.`,
      });
    }
    console.log(
      `retireved transaction with transaction_uuid ${transaction_uuid}.\n${JSON.stringify(
        results[0],
        null,
        2
      )}`
    );
    return res.status(200).json(results[0]);
  });
});

//creates transaction and assigns it a transaction_UUID
transactionRouter.post("/transaction", (req, res) => {
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

//modifies transactions via UUID
transactionRouter.put("/transaction/:uuid", (req, res) => {
  const transaction_uuid = req.params.uuid;

  const { transaction_name, transaction_amount, transaction_details } =
    req.body;

  // validate input values
  const valueDictionary = {
    transaction_name: transaction_name,
    transaction_amount: transaction_amount,
    transaction_details: transaction_details,
  };

  //TODO: don't check empty for optional fields
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

  const updated_timestamp = new Date();

  const query =
    "UPDATE transaction SET transaction_name = ?, transaction_amount = ?, transaction_details = ?, updated_timestamp = ?  WHERE transaction_uuid = ?";

  const values = [
    transaction_name,
    transaction_amount,
    JSON.stringify(transaction_details),
    updated_timestamp, //updated_timestamp
    transaction_uuid,
  ];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error(`Error ${err.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: `Unable to update transaction ${transaction_uuid} due to an unexpected error. Check details and try again.`,
      });
    }

    console.log(
      `Updated transaction\n
      transaction_uuid: '${transaction_uuid}'\n
      transaction_name: '${transaction_name}\n
      transaction_amount: '${transaction_amount}\n
      transaction_details: '${JSON.stringify(transaction_details, null)}\n
      updated_timestamp: '${updated_timestamp}'`
    );
    return res.status(200).json({
      transaction_uuid: transaction_uuid,
      transaction_name: transaction_name,
      transaction_amount: transaction_amount,
      transaction_details: transaction_details,
      updated_timestamp: updated_timestamp,
    });
  });
});

transactionRouter.delete("/transaction/:uuid", (req, res) => {
  const transaction_uuid = req.params.uuid;
  const deleted_timestamp = new Date();
  const query = "DELETE from transaction WHERE transaction_uuid = ?";

  db.query(query, transaction_uuid, (err, results) => {
    if (err) {
      console.error(`Error connecting to the database. ${err.message}`);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: `Unable to delete transaction uuid ${transaction_uuid} due to an unexpected error, or transaction might not exist. Check details and try again.`,
      });
    }
    console.log(`Deleted transaction\n
      transaction_uuid: '${transaction_uuid}', 
      deleted_timestamp: '${deleted_timestamp}'
      `);

    return res.status(200).json({
      transaction_uuid: transaction_uuid,
      deleted_timestamp: deleted_timestamp
    });
  });
});

export default transactionRouter;
