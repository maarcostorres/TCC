const { MongoClient } = require('mongodb');

// URI do .env.local
const uri = "mongodb+srv://admin:pokemon1234@cluster007.42qmieu.mongodb.net/?appName=Cluster007";

async function run() {
    const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    });

    try {
        console.log("Tentando conectar ao MongoDB Atlas...");
        await client.connect();
        console.log("✅ CONEXÃO ESTABELECIDA COM SUCESSO!");
        
        const db = client.db('test');
        console.log("Listando bancos disponíveis:");
        const dbs = await client.db().admin().listDatabases();
        console.log(dbs.databases.map(d => d.name));

    } catch (err) {
        console.error("❌ FALHA NA CONEXÃO:");
        console.error("Mensagem:", err.message);
        console.error("Código:", err.code);
        if (err.reason) console.error("Razão:", err.reason);
    } finally {
        await client.close();
    }
}

run();
