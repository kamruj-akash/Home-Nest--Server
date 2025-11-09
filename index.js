const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseAdminSDK.json");
require("dotenv").config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).send("un-authorize access!");
    return;
  }
  const userToken = req.headers.authorization.split(" ")[1];
  if (!userToken) {
    res.status(401).send("un-authorize access!");
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(userToken);
    req.tokenEmail = decoded.email;
    next();
  } catch {
    return res.status(404).send({ message: "forbidden access!" });
  }
};

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.mongoDb_user}:${process.env.mongoDb_pass}@cluster0.fp6ppm2.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // create collections
    const homeNestDB = client.db("homeNest_database");
    const propertyCollection = homeNestDB.collection("properties");
    const ratingsCollection = homeNestDB.collection("ratings");

    // property related APIs
    app.post("/properties", verifyFirebaseToken, async (req, res) => {
      const newProperty = req.body;
      const result = await propertyCollection.insertOne(newProperty);
      res.send(result);
    });

    app.get("/all-properties", async (req, res) => {
      const cursor = propertyCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/latest-properties", async (req, res) => {
      const cursor = propertyCollection
        .find()
        .sort({ postedDate: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/property/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const propertyId = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(propertyId);
      res.send(result);
    });

    app.get("/property", verifyFirebaseToken, async (req, res) => {
      const firebaseTokenEmail = req.tokenEmail;
      const userEmail = req.query.email;

      const query = {};
      if (userEmail == firebaseTokenEmail) {
        query.owner_email = userEmail;
        const cursor = propertyCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    });

    app.delete("/property/:id", async (req, res) => {
      const id = req.params.id;
      const propertyId = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(propertyId);
      res.send(result);
    });

    // Ratings related APIs
    app.post("/ratings", verifyFirebaseToken, async (req, res) => {
      const ratingsBody = req.body;
      const result = await ratingsCollection.insertOne(ratingsBody);
      res.send(result);
    });

    app.get("/ratings", verifyFirebaseToken, async (req, res) => {
      const firebaseTokenEmail = req.tokenEmail;
      const userEmail = req.query.email;
      const query = {};
      if (userEmail == firebaseTokenEmail) {
        query.reviewerEmail = userEmail;
        const cursor = ratingsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    });

    app.delete("/ratings/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const ratingId = { _id: new ObjectId(id) };
      const result = await ratingsCollection.deleteOne(ratingId);
      res.send(result);
    });

    // APIs end here
    await client.db("admin").command({ ping: 1 });
    console.log("successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// app
app.get("/", (req, res) => {
  res.send("api working fine!");
});
app.listen(port, () => {
  console.log(`app running on: ${port}`);
});
