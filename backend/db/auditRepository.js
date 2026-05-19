const fs = require("fs/promises");
const path = require("path");

const { MongoClient, ServerApiVersion } = require("mongodb");

const DATA_DIR = path.join(__dirname, "..", "data", "audits");

class AuditRepository {
  constructor() {
    this.collectionPromise = null;
    this.mode = process.env.MONGODB_URI ? "mongodb" : "file";
  }

  async connect() {
    if (this.mode !== "mongodb") {
      await fs.mkdir(DATA_DIR, { recursive: true });
      return;
    }

    await this.getCollection();
  }

  getMode() {
    return this.mode;
  }

  async listAll() {
    if (this.mode === "mongodb") {
      const collection = await this.getCollection();
      return collection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
    }

    const fileNames = await fs.readdir(DATA_DIR).catch(() => []);
    const audits = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => {
          try {
            const contents = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
            return JSON.parse(contents);
          } catch (_error) {
            return null;
          }
        }),
    );

    return audits.filter(Boolean);
  }

  async findById(auditId) {
    if (this.mode === "mongodb") {
      const collection = await this.getCollection();
      return collection.findOne({ id: auditId }, { projection: { _id: 0 } });
    }

    const filePath = path.join(DATA_DIR, `${auditId}.json`);
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  }

  async upsert(audit) {
    if (this.mode === "mongodb") {
      const collection = await this.getCollection();
      await collection.replaceOne({ id: audit.id }, audit, { upsert: true });
      return;
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, `${audit.id}.json`), JSON.stringify(audit, null, 2), "utf8");
  }

  async getCollection() {
    if (!this.collectionPromise) {
      this.collectionPromise = this.createCollection();
    }

    return this.collectionPromise;
  }

  async createCollection() {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();

    const database = client.db(process.env.MONGODB_DB_NAME || "seo_audit_app");
    const collection = database.collection(process.env.MONGODB_COLLECTION || "audits");

    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });

    return collection;
  }
}

module.exports = AuditRepository;
