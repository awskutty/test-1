/*
@Service name       : Torus Devops Service,
@Description        : This is a main file for all api calls in this service,
@Number of API's    : 2
*/

const { GetRedisConnection } = require('./helper_files/redis');


try {

    // Require dependencies
    var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
    var reqRedisInstance = require('../../../torus-references/instance/RedisInstance');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');
    var reqDBInstance = require('../../../torus-references/instance/DBInstance');
    var fs = require('fs')
    var path = require("path");
    var async = require('async');
    var servicePath = 'DevopsService';
    var objLogInfo = null;

    // Include the cluster module
    var reqCluster = require('cluster');
    // Code to run if we're in the master process
    if (!reqCluster.isMaster) {
        // Count the machine's CPUs
        var cpuCount = require('os').cpus().length;
        // Create a worker for each CPU
        for (var i = 0; i < cpuCount; i += 1) {
            reqCluster.fork();
        }
        // Listen for dying workers
        reqCluster.on('exit', function (worker) {
            // Replace the dead worker, we're not sentimental
            console.log('Worker %d died :(', worker.id);
            reqCluster.fork();
        });
        // Code to run if we're in a worker process
    } else {
        var reqEvents = require('events');

        var objEvents = new reqEvents();
        objEvents.on('EventAfterInit', AfterInitDBListener);
        process.title = 'Torus_Svc_DevopsService';
        // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
        //     if (pResult == 'SUCCESS') {
        //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
        //         objEvents.emit('EventAfterInit');
        //     }
        // });
        reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
            reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
                reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
                objEvents.emit('EventAfterInit');
            });
        })
        async function AfterInitDBListener() {
            try {
                var arrRoutes = [];
                var reqPing = require('./routes/Ping');
                var reqAppSpace = require('./routes/AppSpace');
                arrRoutes.push(reqAppSpace);
                arrRoutes.push(reqPing);
                reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
                try {
                    var redisdatafile = './redis/data.json'
                    if (fs.existsSync(redisdatafile)) {
                        var insertdata = fs.readFileSync(redisdatafile)
                        if (insertdata) {
                            insertdata = JSON.parse((insertdata.toString()));
                            var ReplaceVariable = ["CLIENT_ID", "TENANT_ID", "APP_ID", "ENV_CODE", "DB_TYPE", "SOLR", "SOLR_PORT", "ORACLE_DATABASE", "ORACLE_PASSWORD", "REPLICATION_FACTOR", "PG_SERVER", "PG_PORT", "PG_USERNAME", "PG_PASSWORD", "DB_NAME"];
                            var ClientParams = {}
                            ClientParams.SOLR = (process.env.solr_master_host) ? process.env.solr_master_host : "solr";
                            ClientParams.SOLR_PORT = (process.env.solr_master_port) ? process.env.solr_master_port : "8983";
                            ClientParams.ORACLE_DATABASE = (process.env.oracle_default_db) ? process.env.oracle_default_db : "xe";
                            ClientParams.ORACLE_PASSWORD = process.env.oracle_password = (process.env.oracle_password) ? process.env.oracle_password : "0791c79ca20b9afa312aa062eb357dd4416dffa4d10af5bc80ec11972afcbe9b9abc653e";
                            ClientParams.REPLICATION_FACTOR = (process.env.kafka_replication_factor) ? process.env.kafka_replication_factor : "1";
                            ClientParams.PG_SERVER = (process.env.pg_server) ? process.env.pg_server : "postgres";
                            ClientParams.PG_PORT = (process.env.pg_port) ? process.env.pg_port : "5432";
                            ClientParams.PG_USERNAME = (process.env.pg_username) ? process.env.pg_username : "postgres";
                            ClientParams.PG_PASSWORD = (process.env.pg_password) ? process.env.pg_password : "f8bb3013b12ea64b636c8185b6234be96cb6f4a349c26bebc4ce717ce66075427b00686e";
                            //ClientParams.DB_NAME = (process.env.db_name) ? process.env.db_name : "clt1304_envdefault_app200_tnt_tran";
                            async.forEachOfSeries(insertdata, async function (idata, index, errorFileCB) {
                                try {
                                    var redisConn = await GetRedisConnection(index);

                                    var defaultkeyval = await redisConn.get('POSTGRES~CLT-0~APP-0~TNT-0~ENV-0')
                                    if (defaultkeyval) {
                                        ClientParams.DB_NAME = JSON.parse(defaultkeyval).PostgresServers[0].Database
                                    }
                                    for (var i = 0; i < idata.length; i++) {
                                        var redisEntry = idata[i].value
                                        ReplaceVariable.forEach((replacingData) => {
                                            var regex1 = new RegExp(`#${replacingData}#`, 'g');
                                            redisEntry = redisEntry.replace(regex1, ClientParams[replacingData]);
                                            // var regex2 = new RegExp(`#${data.toLowerCase()}#`, 'g');
                                            // redisEntry = redisEntry.replace(regex2, ClientParams[data].toLowerCase());
                                        })
                                        await redisConn.set(idata[i].key, redisEntry);
                                    }
                                } catch (error) {
                                    console.log(error)
                                }
                            }, function (error) {
                                if (error) {
                                    console.log(error)
                                } else {
                                    console.log("Redis insert success.");
                                    // const currentPath = path.join(__dirname, "redis", "data.json");
                                    // const destinationPath = path.join(__dirname, "redis/completed", `data_${new Date().toDateString()}_${new Date().toLocaleTimeString().replaceAll(":", '_')}.json`);
                                    // if (!fs.existsSync(path.join(__dirname, "redis/completed"))) {
                                    //     fs.mkdirSync(path.join(__dirname, "redis/completed"));
                                    // }
                                    // fs.rename(currentPath, destinationPath, function (err) {
                                    //     if (err) {
                                    //         console.log(err)
                                    //     } else {
                                    //         console.log("Redis insert success.File moved the completed folder.");
                                    //     }
                                    // });
                                }
                            })
                        }
                    } else {
                        console.log('Reids insert data file not available.')
                    }

                } catch (error) {

                }
                // reqGetHeaderInfo.GetHeaderInfo(function () {
                //     reqInstanceHelper.PrintInfo(servicePath, 'All Threads started successfully.', objLogInfo);
                // });

                // reqMessageCreator.MessageCreator();
                // reqMessageFailureHandler.FailureHandler();
            }
            catch (error) {
                reqInstanceHelper.PrintInfo(servicePath, error.toString(), objLogInfo);
                console.log(error, '============================');
            }
        }
        const GetRedisConnection = function (dbindex) {
            return new Promise((resolve, reject) => {
                reqRedisInstance.GetRedisConnectionwithIndex(dbindex, function (error, clientR) {
                    if (error) {
                        reject(error.toString());
                    }
                    else {
                        resolve(clientR)
                    }
                });
            })

        }
    }
} catch (error) {
    reqInstanceHelper.PrintInfo(servicePath, error.toString(), {});
    console.log(error, '============================');
}
/******** End of File *******/