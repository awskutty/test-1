var FileSystem = require("fs");
var reqRedis = require('redis');
var redisInstance = require('../../../../../torus-references/instance/RedisInstance.js');
var dbInstance = require("../../../../../torus-references/instance/DBInstance")

//var CreateDefaultRedisEntries = async function(ClientParams) {
async function CreateDefaultRedisEntries(ClientParams) {
    try {
        var ReplaceVariable = ["CLIENT_ID", "TENANT_ID", "APP_ID", "ENV_CODE", "DB_TYPE", "SOLR", "SOLR_PORT", "ORACLE_DATABASE", "ORACLE_PASSWORD", "REPLICATION_FACTOR", "PG_SERVER", "PG_PORT", "PG_USERNAME", "PG_PASSWORD"];
        var strCnfPath = __dirname + "/defaultentries.json";
        if (FileSystem.existsSync(strCnfPath)) {
            strChangeInfo = FileSystem.readFileSync(strCnfPath).toString();
        }
        if (strChangeInfo != "") {
            var radisConnection = undefined;
            if (process.env.redis_master) {
                radisConnection = await GetRedisMasterConnection();
            } else {
                radisConnection = await GetRedisConnection();
            }
            ClientParams.SOLR = (process.env.solr_master_host) ? process.env.solr_master_host : "solr";
            ClientParams.SOLR_PORT = (process.env.solr_master_port) ? process.env.solr_master_port : "8983";
            ClientParams.ORACLE_DATABASE = (process.env.oracle_default_db) ? process.env.oracle_default_db : "xe";
            ClientParams.ORACLE_PASSWORD = process.env.oracle_password = (process.env.oracle_password) ? process.env.oracle_password : "0791c79ca20b9afa312aa062eb357dd4416dffa4d10af5bc80ec11972afcbe9b9abc653e";
            ClientParams.REPLICATION_FACTOR = (process.env.kafka_replication_factor) ? process.env.kafka_replication_factor : "1";
            ClientParams.PG_SERVER = (process.env.pg_server) ? process.env.pg_server : "postgres";
            ClientParams.PG_PORT = (process.env.pg_port) ? process.env.pg_port : "5432";
            ClientParams.PG_USERNAME = (process.env.pg_username) ? process.env.pg_username : "postgres";
            ClientParams.PG_PASSWORD = (process.env.pg_password) ? process.env.pg_password : "f8bb3013b12ea64b636c8185b6234be96cb6f4a349c26bebc4ce717ce66075427b00686e";
            var objChangeInfo = JSON.parse(strChangeInfo);
            var DBTYPE = ClientParams.DB_TYPE.toLowerCase();
            var selectedRedisData = objChangeInfo[DBTYPE];
            for (var iCnfcnt = 0; iCnfcnt < selectedRedisData.length; iCnfcnt++) {
                var redisEntry = JSON.stringify(selectedRedisData[iCnfcnt]);
                ReplaceVariable.forEach((data) => {
                    var regex1 = new RegExp(`#${data}#`, 'g');
                    redisEntry = redisEntry.replace(regex1, ClientParams[data]);
                    // var regex2 = new RegExp(`#${data.toLowerCase()}#`, 'g');
                    // redisEntry = redisEntry.replace(regex2, ClientParams[data].toLowerCase());
                })
                var regex3 = new RegExp(`#DB_NAME#`, 'g');
                redisEntry = redisEntry.replace(regex3, ClientParams["DB_NAME"]);
                var data = JSON.parse(redisEntry);
                data.value = JSON.parse(data.value);
                if (data.key == "SERVICE_MODEL") {
                    await SetServiceModel(data.value);
                }
                await SetRedisData(radisConnection, data)
            }
            if (process.env.redis_master && radisConnection) {
                radisConnection.quit();
            }
        }
    } catch (error) {
        console.log(error)
    }

}

const GetRedisConnection = function () {
    return new Promise((resolve, reject) => {
        redisInstance.GetRedisConnection(function (error, clientR) {
            if (error) {
                reject(error.toString());
            }
            else {
                resolve(clientR)
            }
        });
    })

}

const GetRedisMasterConnection = function () {
    return new Promise((resolve, reject) => {
        redisInstance.GetRedisDetail(function (error, redisConfig) {
            if (error) {
                reject(error.toString());
            }
            else {
                var redisMasterInfo = JSON.parse(process.env.redis_master);
                var clientRedis = reqRedis.createClient({
                    host: redisMasterInfo.Server,
                    port: redisMasterInfo.Port,
                    password: new Buffer(redisMasterInfo.Password, 'base64').toString()
                });
                resolve(clientRedis)
            }
        });
    })
}

const SetServiceModel = function (data) {
    return new Promise((resolve, reject) => {
        try {
            dbInstance.LoadServiceModel('SERVICE_MODEL', data, function (res) {
                console.log("successfuly set the service model data");
                resolve(res)
            });
        } catch (err) {
            console.log("  error in set the service model data");
            console.log(err.toString());
            reject(err.toString())
        }
    });
}

const SetRedisData = function (RedisSession, data) {
    return new Promise(async (resolve, reject) => {
        // RedisSession.set(data.key, JSON.stringify(data.value), function (error, object) {
        //     if (error) {
        //         reject(error.toString());
        //     }
        //     else {
        //         resolve(object);
        //     }
        // });
        await RedisSession.set(data.key, JSON.stringify(data.value))
        resolve();
    });
}

const GetRedisData = function (RedisSession, key) {
    return new Promise(async (resolve, reject) => {
        var redisvalue = await RedisSession.get(key)
        resolve(redisvalue)
        // RedisSession.get(key, function (error, object) {
        //     if (error) {
        //         reject(error.toString());
        //     }
        //     else {
        //         resolve(object);
        //     }
        // });
    });
}
module.exports = {
    CreateDefaultRedisEntries: CreateDefaultRedisEntries,
    GetRedisConnection: GetRedisConnection,
    GetRedisData: GetRedisData,
    SetRedisData: SetRedisData
}